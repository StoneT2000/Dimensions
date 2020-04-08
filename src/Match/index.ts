import { DeepPartial } from '../utils/DeepPartial';
import { deepMerge } from '../utils/DeepMerge';
import { MatchEngine } from '../MatchEngine';
import { Agent } from '../Agent';
import { Logger } from '../Logger';
import { Design } from '../Design';
import { FatalError } from '../DimensionError';
import { Tournament } from '../Tournament';
import EngineOptions = MatchEngine.EngineOptions;
import COMMAND_STREAM_TYPE = MatchEngine.COMMAND_STREAM_TYPE;
import Command = MatchEngine.Command;

/**
 * @class Match
 * @classdesc An match created using a {@link Design} and a list of Agents. The match can be stopped and resumed with 
 * {@link stop}, {@link resume}, and state and configurations can be retrieved at any point in time with the 
 * {@link state} and {@link configs} fields
 * 
 * @see {@link Design} for Design information
 * @see {@link Agent} for Agent information
 */

export class Match {

  /**
   * When the match was created (called with new)
   */
  public creationDate: Date;

  /**
   * Name of the match
   */
  public name: string;
  
  /**
   * A unique ID for the match, unique to the current node process
   */
  public id: number;

  private shouldStop: boolean = false;
  private resumePromise: Promise<void>;
  private resumeResolve: Function;

  private static _id: number = 0;

  /**
   * The state field. This can be used to store anything by the user when this `match` is passed to the {@link Design} life cycle functions {@link Design.initialize}, {@link Design.update}, and {@link Design.getResults}
   */
  public state: any;

  /**
   * List of the agents currently involved in the match.
   * @See {@link Agent} for details on the agents.
   */
  public agents: Array<Agent>;

  /**
   * Map from an {@link Agent.ID} ID to the {@link Agent}
   */
  public idToAgentsMap: Map<Agent.ID, Agent> = new Map();

  /**
   * The current time step of the Match. This time step is independent of any {@link Design} and agents are coordianted 
   * against this timeStep
   */
  public timeStep: number = 0;

  /**
   * The associated {@link MatchEngine} that is running this match and serves as the backend for this match.
   */
  public matchEngine: MatchEngine; // could potentially made MatchEngine all static, but each match engine does have configurations dependent on design and per match, so holding this as a private field 

  /**
   * The match logger. 
   * @see {@link Logger} for details on how to use this
   */
  public log = new Logger();

  /**
   * The results field meant to store any results retrieved with {@link Design.getResults}
   */
  public results: any;

  /**
   * The current match status
   */
  public matchStatus: Match.Status = Match.Status.UNINITIALIZED

  /**
   * A mapping from {@link Agent} IDs to the tournament id of the {@link Player} in a tournament that generated the
   * {@link Agent}
   */
  public mapAgentIDtoTournamentID: Map<Agent.ID, Tournament.ID> = new Map();

  /**
   * Match Configurations. See {@link Match.Configs} for configuration options
   */
  public configs: Match.Configs = {
    name: '',
    loggingLevel: Logger.LEVEL.INFO,
    dimensionID: null,
    engineOptions: {}
  };

  /**
   * Match Constructor
   * @param design - The {@link Design} used
   * @param agents - List of agents used to create Match.
   * @param configs - Configurations that are passed to every run through {@link Design.initialize}, {@link Design.update}, and {@link Design.getResults} functioon in the 
   * given {@link Design}
   */
  constructor(
    public design: Design, 
    public agentFiles: Array<String> | Array<{file: string, name: string}> | Array<{file: string, tournamentID: Tournament.ID}>, 
    configs: DeepPartial<Match.Configs> = {}
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
   * Initializes this match using its configurations and using the {@link Design.initialize} function
   * @returns a promise that resolves true/false if initialized correctly
   */
  public async initialize(): Promise<boolean> {
    return new Promise( async (resolve, reject) => {
      try {

        this.log.infobar();
        this.log.info(`Design: ${this.design.name} | Initializing match: ${this.name}`);
        this.log.detail('Match Configs', this.configs);
        
        this.timeStep = 0;
        
        // Initialize agents with agent files
        this.agents = Agent.generateAgents(this.agentFiles, this.log.level);
        this.agents.forEach((agent) => {
          this.idToAgentsMap.set(agent.id, agent);
          if (agent.tournamentID !== null) {
            this.mapAgentIDtoTournamentID.set(agent.id, agent.tournamentID);
          }
        })

        // Initialize the matchEngine and get it ready to run and process I/O for agents
        await this.matchEngine.initialize(this.agents, this);
        
        // by now all agents should up and running, all compiled and ready
        // Initialize match according to `design` by delegating intialization task to the enforced `design`
        await this.design.initialize(this);

        // remove initialized status and set as READY
        // TODO: add more security checks etc. before marking match as ready to run
        this.matchStatus = Match.Status.READY;
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
    let status: Match.Status;
    // Run match
    do {
      status = await this.next();

    }
    while (status != Match.Status.FINISHED)
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
  public async next(): Promise<Match.Status> {
    return new Promise(async (resolve, reject) => {
      const engineOptions = this.matchEngine.getEngineOptions()
      if (engineOptions.commandStreamType === COMMAND_STREAM_TYPE.SEQUENTIAL) {
        // if this.shouldStop is set to true, await for the resume promise to resolve
        if (this.shouldStop == true) {
          // set status and stop the engine
          this.matchStatus = Match.Status.STOPPED;
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
        const status: Match.Status = await this.design.update(this, commands);

        // default status is running if no status returned
        if (!status) {
          this.matchStatus = Match.Status.RUNNING
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
    
    if (this.matchStatus != Match.Status.RUNNING) {
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
    if (this.matchStatus != Match.Status.STOPPED) {
      this.log.error('You can\'t resume a match that is not stopped');
      return false;
    }
    this.log.info('Resuming match...');
    // set back to running and resolve
    this.matchStatus = Match.Status.RUNNING;
    this.resumeResolve();
    
    return true;

  }

  /**
   * Stop all agents through the match engine
   */
  private async stopAndCleanUp() {
    await this.matchEngine.killAndClean(this);
  }

  /**
   * Terminate an {@link Agent}, kill the process. Note, the agent is still stored in the Match, but you can't send or 
   * receive messages from it anymore
   */
  public async kill(agent: Agent.ID | Agent) {
    
    if (agent instanceof Agent) {
      this.matchEngine.kill(agent);
    }
    else {
      this.matchEngine.kill(this.idToAgentsMap.get(agent));
    }
  }

  /**
   * Retrieve results through delegating the task to {@link Design.getResults}
   */
  public async getResults() {
    return new Promise( async (resolve, reject) => {
      try {
        // Retrieve match results according to `design` by delegating storeResult task to the enforced `design`
        let res = await this.design.getResults(this);
        resolve(res);
      }
      catch(error) {
        reject(error);
      }
    });
  }

  /* TODO
   * Set the move resolve policy
   * @param config - The configuration to use for the next update. Specifically set conditions for when MatchEngine 
   * should call agent.currentMoveResolve() and thus return commands and move to next update
   */
  // public async setAgentResolvePolicy(config = {}) {

  // }

  /**
   * Sends a message to the standard input of all agents in this match
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
   * Functional method for sending a message string to a particular {@link Agent}. Returns a promise that resolves true 
   * if succesfully sent
   * @param message - the string message to send
   * @param receiver - receiver of message can be specified by the {@link Agent} or it's {@link Agent.ID} (a number)
   */
  public async send(message: string, receiver: Agent | Agent.ID): Promise<boolean> {
    if (receiver instanceof Agent) {
      return this.matchEngine.send(this, message, receiver.id);
    }
    else {
      return this.matchEngine.send(this, message, receiver);
    }
  }

  /**
   * Throw an error within the Match, indicating an {@link Agent} tried a command that was forbidden in the match
   * according to a the utilized {@link Design}
   * Examples are misuse of an existing command or using incorrect commands or sending too many commands
   * @param agentID - the misbehaving agent's ID
   * @param error - The error
   */
  public async throw(agentID: Agent.ID, error: Error) {

    // Fatal errors are logged and end the whole match
    // TODO: Try to use `instanceof`
    if (error.name === 'Dimension.FatalError') {
      console.log('FATAL')
      this.stopAndCleanUp().then(() => {
        throw new FatalError(`${this.idToAgentsMap.get(agentID).name} | ${error.message}`); 
      })
    }
    if (error.name === 'Dimension.MatchWarning') {
      this.log.warn(`ID: ${agentID}, ${this.idToAgentsMap.get(agentID).name} | ${error}`);
    }
    if (error.name === 'Dimension.MatchError') {
      this.log.error(`ID: ${agentID}, ${this.idToAgentsMap.get(agentID).name} | ${error}`);
      // TODO, if match is set to store an error log, this should be logged!
    }
  }
}

export module Match {
  /**
   * Match Configurations. Has 4 specified fields. All other fields are up to user discretion
   */
  export interface Configs {
    /**
     * Name of the match
     */
    name: string
    /**
     * Logging level for this match.
     * @see {@link Logger}
     */
    loggingLevel: Logger.LEVEL,
    /**
     * The id of the dimension this match was generated from if there is one
     */
    dimensionID: number,
    /**
     * The engine options to use in this match.
     */
    engineOptions: DeepPartial<EngineOptions>
    [key: string]: any
  }
  export enum Status {
    /** Match was created with new but initialize was not called */
    UNINITIALIZED = 'uninitialized',
    /**
     * If the match has been initialized and checks have been passed, the match is ready to run using {@link Match.run}
     */
    READY = 'ready',
    /**
     * If the match is running at the moment
     */
    RUNNING = 'running', // if match is running at the moment
    /**
     * If the match is stopped
     */
    STOPPED = 'stopped',
    /**
     * If the match is completed
     */
    FINISHED = 'finished', // if match is done
    /**
     * If fatal error occurs in Match, appears when match stops itself
     */
    ERROR = 'error'
  }
}