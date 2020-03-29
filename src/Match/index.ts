import { Agent, Design, MatchEngine, agentID, Logger, LoggerLEVEL, Command, FatalError, COMMAND_STREAM_TYPE } from '..';

export enum MatchStatus {
  RUNNING,
  STOPPED,
  FINISHED
}

// Life cycle configurations for a match, dependent on the `Design`
// TODO: add any property with type any
export type MatchConfigs = {
  name?: any
  timeout?: number, // number of milliseconds to give each agent before stopping them
  initializeConfig?: any, 
  updateConfig?: any,
  storeResultConfig?: any,
  loggingLevel?: LoggerLEVEL
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

  private matchEngine: MatchEngine;

  private log = new Logger();

  constructor(
    public design: Design, 
    public agentFiles: Array<String> | Array<{file: string, name: string}>, 
    public configs: MatchConfigs = {}
  ) {
    this.creationDate = new Date();
    if (configs.name) {
      this.name = configs.name;
    }
    else {
      this.name = `match_${Match._id}`;
    }

    this.log.level = configs.loggingLevel;

    // store reference to the matchEngine used
    this.matchEngine = new MatchEngine(this.design);
    this.id = Match._id;
    Match._id++;
  }

  /**
   * Initializes using this config dependeing on how `Design's` `initialize` is implemented
   * @param config - Configurations for initializtion
   * @returns a promise that resolves true/false if initialized correctly
   */
  public async initialize(): Promise<boolean> {
    return new Promise( async (resolve, reject) => {
      try {

        this.log.infobar();
        this.log.info(`${this.design.name} | Initializing match: ${this.name}`);

        // Initialize agent files to agents, no names specified, and use the same logging level as this `match`
        this.agents = Agent.generateAgents(this.agentFiles, this.log.level);
        this.agents.forEach((agent, index) => {
          this.idToAgentsMap.set(agent.id, agent);
        })

        // Initialize the matchEngine and get it ready to run and process I/O for agents
        await this.matchEngine.initialize(this.agents, this, this.log.level);
        
        // Initialize match according to `design` by delegating intialization task to the enforced `design`
        await this.design.initialize(this, this.configs.initializeConfig);
        
        resolve(true);
        
      }
      catch(error) {
        reject(error);
      }
    });
  }
  /**
   * Run function. Resolves when match marks itself as complete. 
   */
  public async run(): Promise<MatchStatus> {
    return new Promise(async (resolve, reject) => {
      if (this.matchEngine.engineOptions.commandStreamType === COMMAND_STREAM_TYPE.SEQUENTIAL) {
        // at the start of each time step, we send any updates based on what agents sent us on the previous timestep
        // Updates sent by agents on previous timestep can be obtained with MatchEngine.getCommands
        // This is also the COORDINATION step, where we essentially wait for all commands from all agents to be
        // delivered out
        const commands: Array<Command> = await this.matchEngine.getCommands();
  
        // Updates the match state and sends appropriate signals to all Agents based on the stored `Design`
        const status: MatchStatus = await this.design.update(this, commands, this.configs.updateConfig);
        
        if (status === MatchStatus.FINISHED) {
          await this.stopAndCleanUp();
        }
        // update timestep now
        this.timeStep += 1;

        resolve(status);
      }

      // TODO: implement this
      else if (this.matchEngine.engineOptions.commandStreamType === COMMAND_STREAM_TYPE.PARALLEL) {
        // with a parallel structure, the `Design` updates the match after each command sequence, delimited by \n
        // this means agents end up sending commands using out of sync state information, so the `Design` would need to 
        // adhere to this. Possibilities include stateless designs, or heavily localized designs where out of 
        // sync states wouldn't matter much
      }
    })

  }

  /**
   * Stops at the nearest timestep available
   * 
   * Notes:
   * - If design uses a PARALLEL match engine, stopping behavior can be a little unpredictable
   * - If design uses a SEQUENTIAL match engine, a stop will result in ensuring all agents complete all their actions up
   *   to a coordinated stopping `timeStep`
   */
  public async stop() {
    // if (this.design.matchEngine.)
  }

  public async stopAndCleanUp() {
    await this.matchEngine.killAndClean();
  }

  public async getResults() {
    return new Promise( async (resolve, reject) => {
      try {
        // Retrieve match results according to `design` by delegating storeResult task to the enforced `design`
        let res = await this.design.getResults(this, this.configs.storeResultConfig);
        resolve(res);
      }
      catch(error) {
        reject(error);
      }
    });
  }


  // sends a message string to every agent
  public async sendAll(message: string) {
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
      return this.matchEngine.send(message, receiver.id);
    }
    else {
      return this.matchEngine.send(message, receiver);
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
    }
  }
}