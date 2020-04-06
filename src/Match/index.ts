import { Agent, Design, MatchEngine, agentID, Logger, LoggerLEVEL, Command, FatalError, COMMAND_STREAM_TYPE } from '..';
import { DeepPartial } from '../utils/DeepPartial';
import { deepMerge } from '../utils/DeepMerge';
import { EngineOptions } from '../MatchEngine';

export enum MatchStatus {
  UNINITIALIZED, // the status when you just created a match and didn't call initialize
  READY, // if match has been initialized and checks passed and is ready to run using match.run()
  RUNNING, // if match is running at the moment
  STOPPED, // if match is stopped, not used at the moment
  FINISHED, // if match is done
  ERROR // if error occurs, currently not used, but should be somehow integrated into the Match class, appearing when 
  // match stops by itself due to an error
}

// Life cycle configurations for a match, dependent on the `Design`
export type MatchConfigs = {
  name: string
  initializeConfig: any,
  updateConfig: any,
  getResultConfig: any,
  loggingLevel: LoggerLEVEL,
  dimensionID: number, // id of the dimension match resides in
  engineOptions: DeepPartial<EngineOptions> // overriden engine options
  [key: string]: any
}
/**
 * @class Match
 * @classdesc An match created using a `Design` and a list of `Agents`. The match can be started and stopped, and 
 * statistics can be retrieved at any point in time. This can be extended if needed
 * @param design - The `Design` used
 * @param agents - List of agents used to create Match.
 * @param configs - Configurations that are passed to every run through initialize, update, and storeResults in the 
 * given `Design`
 */

export class Match {
  public creationDate: Date;

  public name: string;
  public id: number;

  private shouldStop: boolean = false;
  private resumePromise: Promise<void>;
  private resumeResolve: Function;

  private static _id: number = 0;

  // Contains all information required to initiate the same Match state again at any time
  // NOTE: This cannot fully re-instantiate a match with the same `Agents` due to possibility of `Agents` having their own data that may not be stored in the `Match`
  // This state is to be used by user at its full discretion when implementing the abstracted functions of `Design`
  public state: any;

  // This is the public list of agents involved in a match. Users should use agents to their full discretion when trying
  // to send a message to each agent.
  public agents: Array<Agent>;
  public idToAgentsMap: Map<agentID, Agent> = new Map();

  // The time step of the Match. All agents are coordinated against this timeStep
  public timeStep: number = 0;

  public matchEngine: MatchEngine; // could potentially made MatchEngine all static, but each match engine does have configurations dependent on design and per match, so holding this as a private field 

  public log = new Logger();

  public results: any;
  public matchStatus = MatchStatus.UNINITIALIZED

  public configs: MatchConfigs = {
    name: '',
    timeout: 1000,
    initializeConfig: {},
    updateConfig: {},
    getResultConfig: {},
    loggingLevel: Logger.LEVEL.INFO,
    dimensionID: null,
    engineOptions: {}
  }

  constructor(
    public design: Design, 
    public agentFiles: Array<String> | Array<{file: string, name: string}>, 
    configs: DeepPartial<MatchConfigs> = {}
  ) {

    // override configs with provided configs argument
    this.configs = deepMerge(this.configs, configs);

    this.creationDate = new Date();
    if (this.configs.name) {
      this.name = this.configs.name;
    }
    else {
      this.name = `match_${Match._id}`;
    }

    // set logging level to what was given
    this.log.level = this.configs.loggingLevel;
    this.log.identifier = this.name;

    // store reference to the matchEngine used and override any options
    this.matchEngine = new MatchEngine(this.design, this.log.level);
    this.matchEngine.setEngineOptions(configs.engineOptions);
    this.id = Match._id;
    Match._id++;
  }

  /**
   * Initializes this match using its configurations and using `Design's` `initialize` function
   * @returns a promise that resolves true/false if initialized correctly
   */
  public async initialize(): Promise<boolean> {
    return new Promise( async (resolve, reject) => {
      try {

        this.log.infobar();
        this.log.info(`Design: ${this.design.name} | Initializing match: ${this.name}`);
        this.log.info('Match Configs', this.configs);
        
        this.timeStep = 0;
        
        // Initialize agents with agent files
        this.agents = Agent.generateAgents(this.agentFiles, this.log.level);
        this.agents.forEach((agent) => {
          this.idToAgentsMap.set(agent.id, agent);
        })

        // Initialize the matchEngine and get it ready to run and process I/O for agents
        await this.matchEngine.initialize(this.agents, this);
        
        // by now all agents should up and running, all compiled and ready
        // Initialize match according to `design` by delegating intialization task to the enforced `design`
        await this.design.initialize(this, this.configs.initializeConfig);

        // remove initialized status and set as READY
        // TODO: add more security checks etc. before marking match as ready to run
        this.matchStatus = MatchStatus.READY;
        resolve(true);
        
      }
      catch(error) {
        reject(error);
      }
    });
  }


  /**
   * Runs this match to completion. Resolves / returns the match results when done
   */
  public async run(): Promise<any> {
    let status: MatchStatus;
    // Run match
    do {
      status = await this.next();

    }
    while (status != MatchStatus.FINISHED)
    this.agents.forEach((agent: Agent) => {
      agent.clearTimer();
    })
    this.results = await this.getResults();

    // TODO: Perhaps add a cleanup status if cleaning up processes takes a long time
    await this.stopAndCleanUp();
   
    return this.results;
  }

  /**
   * Next function. Moves match forward by one timestep. Resolves with the match status
   */
  public async next(): Promise<MatchStatus> {
    return new Promise(async (resolve, reject) => {
      const engineOptions = this.matchEngine.getEngineOptions()
      if (engineOptions.commandStreamType === COMMAND_STREAM_TYPE.SEQUENTIAL) {
        // if this.shouldStop is set to true, await for the resume promise to resolve
        if (this.shouldStop == true) {
          // set status and stop the engine
          this.matchStatus = MatchStatus.STOPPED;
          this.matchEngine.stop(this);
          this.log.info('Stopped match');
          await this.resumePromise;
          this.matchEngine.resume(this);
          this.log.info('Resumed match');
          this.shouldStop = false;
        }
        // at the start of each time step, we send any updates based on what agents sent us on the previous timestep
        // Updates sent by agents on previous timestep can be obtained with MatchEngine.getCommands
        // This is also the COORDINATION step, where we essentially wait for all commands from all agents to be
        // delivered out
        const commands: Array<Command> = await this.matchEngine.getCommands(this);
        this.log.system(`Retrieved ${commands.length} commands`);
        // Updates the match state and sends appropriate signals to all Agents based on the stored `Design`
        const status: MatchStatus = await this.design.update(this, commands, this.configs.updateConfig);

        // default status is running if no status returned
        if (!status) {
          this.matchStatus = MatchStatus.RUNNING
        }
        else {
          this.matchStatus = status;
        }
        // after we run update and likely send all the messages that need to be sent, 
        // we now reset each Agent for the next move
        this.agents.forEach((agent: Agent) => {
          // continue agent again
          agent.process.kill('SIGCONT');
          agent._setupMove();
          if (engineOptions.timeout.active) {
            agent.setTimeout(() => {
              // if agent times out, call the provided callback in engine options
              engineOptions.timeout.timeoutCallback(agent, this, engineOptions);
            }, engineOptions.timeout.max + MatchEngine.timeoutBuffer);
          }
          // each of these steps can take ~2 ms
        });

        // update timestep now
        this.timeStep += 1;

        resolve(status);
      }

      // TODO: implement this
      else if (engineOptions.commandStreamType === COMMAND_STREAM_TYPE.PARALLEL) {
        // with a parallel structure, the `Design` updates the match after each command sequence, delimited by \n
        // this means agents end up sending commands using out of sync state information, so the `Design` would need to 
        // adhere to this. Possibilities include stateless designs, or heavily localized designs where out of 
        // sync states wouldn't matter much
      }
    })

  }

  /**
   * Stops at the next nearest timestep possible
   * 
   * Notes:
   * - If design uses a PARALLEL match engine, stopping behavior can be a little unpredictable
   * - If design uses a SEQUENTIAL match engine, a stop will result in ensuring all agents complete all their actions up
   *   to a coordinated stopping `timeStep`
   * @returns true if successfully stopped
   */
  public stop() {
    
    if (this.matchStatus != MatchStatus.RUNNING) {
      this.log.error('You can\'t stop a match that is not running');
      return false;
    }
    this.log.info('Stopping match...');
    this.shouldStop = true;
    this.resumePromise = new Promise((resolve) => {
      this.resumeResolve = resolve;
    });
   
    return true;
  }

  /**
   * Resume the match if it was in the stopped state
   * @returns true if succesfully resumed
   */
  public resume() {
    if (this.matchStatus != MatchStatus.STOPPED) {
      this.log.error('You can\'t resume a match that is not stopped');
      return false;
    }
    this.log.info('Resuming match...');
    // set back to running and resolve
    this.matchStatus = MatchStatus.RUNNING;
    this.resumeResolve();
    
    return true;

  }

  /**
   * Stop all agents through the match engine
   */
  public async stopAndCleanUp() {
    await this.matchEngine.killAndClean(this);
  }

  /**
   * Terminate an agent
   */
  public async kill(agent: agentID | Agent) {
    
    if (agent instanceof Agent) {
      this.matchEngine.kill(agent);
    }
    else {
      this.matchEngine.kill(this.idToAgentsMap.get(agent));
    }
  }

  /**
   * Retrieve results through delegating the task to the design
   */
  public async getResults() {
    return new Promise( async (resolve, reject) => {
      try {
        // Retrieve match results according to `design` by delegating storeResult task to the enforced `design`
        let res = await this.design.getResults(this, this.configs.getResultConfig);
        resolve(res);
      }
      catch(error) {
        reject(error);
      }
    });
  }

  /** TODO
   * Set the move resolve policy
   * @param config - The configuration to use for the next update. Specifically set conditions for when MatchEngine 
   * should call agent.currentMoveResolve() and thus return commands and move to next update
   */
  // public async setAgentResolvePolicy(config = {}) {

  // }

  /**
   * Sends a message to all agent's standard input
   * @param message - the message to send to all agents available 
   * @returns a promise resolving true/false if it was succesfully sent
   */
  public async sendAll(message: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let sendPromises = [];
      this.agents.forEach((agent: Agent) => {
        sendPromises.push(this.send(message, agent));
      })

      Promise.all(sendPromises).then(() => {
        // if all promises resolve, we sent all messages
        resolve(true);
      }).catch((error) => {
        reject(error);
      })
    })
  }

  /**
   * Functional method for sending a message string to a particular agent. Returns a promise that resolves true if
   * succesfully sent
   * @param message 
   * @param receiver - receiver of message can be specified by the `Agent` or it's agentID (a number)
   */
  public async send(message: string, receiver: Agent | agentID) {
    if (receiver instanceof Agent) {
      return this.matchEngine.send(this, message, receiver.id);
    }
    else {
      return this.matchEngine.send(this, message, receiver);
    }
  }

  /**
   * Throw an error within the `Match`, indicating an Agent tried a command that was forbidden in the match according
   * to a `Design`
   * Examples are misuse of an existing command or using incorrect commands
   * @param agentID - the misbehaving agent's ID
   * @param error - The error
   */
  public async throw(agentID: agentID, error: Error) {

    // Fatal errors are logged and end the whole match
    // TODO: Try to use `instanceof`
    if (error.name === 'Dimension.FatalError') {
      console.log('FATAL')
      this.stopAndCleanUp().then(() => {
        throw new FatalError(`${this.idToAgentsMap.get(agentID).name} | ${error.message}`); 
      })
    }
    if (error.name === 'Dimension.MatchError') {
      this.log.warn(`${this.idToAgentsMap.get(agentID).name} | ${error}`);
      // TODO, if match is set to store an error log, this should be logged!
    }
  }
}