import { Match, agentID, MatchStatus, Logger, LoggerLEVEL } from "..";

/**
 * @class Design
 * @classdesc Abstract class detailing a `Design` to be used as the platform that holds competition runtime logic for
 * updating and manipulating ongoing `matches`
 * 
 * Refer to `Match` class for exposed fields available for user's use. User's can also extend the `Match` class and add
 * more fields if they wish for their own use and pass their own `Match` class instantiations
 * 
 */
export abstract class Design {
  
  public designOptions: DesignOptions;
  private log = new Logger();
	constructor(public name: String, designOptions?: Partial<DesignOptions>) {

    // TODO: [Strange] - This design option breaks jest when placed outside, jest thinks LoggerLEVEL.info isn't real
    const DEFAULT_DESIGN_OPTIONS: DesignOptions = {
      commandStreamType: COMMAND_STREAM_TYPE.SEQUENTIAL,
      commandDelimiter: ','
    }
    // Set defaults
    this.designOptions = DEFAULT_DESIGN_OPTIONS;
    // Override with user provided params
    Object.assign(this.designOptions, designOptions);

    // Set log level to default
    this.log.level = Logger.LEVEL.INFO;
    this.log.system(`Initialized Design: ` + this.name);
  }

  _setLogLevel(level: LoggerLEVEL) {
    this.log.level = level;
  }
  
  /**
   * Get the design options associated with this `Design`
   */
  getDesignOptions() : DesignOptions {
    return this.designOptions;
  }

  /**
   * 
   * @param match - The `Match` to initialize state with
   * @param config - Any user configurations that can be added as parameters
   * @returns true if initialized correctly
   */
  abstract async initialize(match: Match, config?: any): Promise<boolean>

	/**
   * Abstract function required to update `match` state with commands from Agents and send commands to Agents
   * along with returning the current match status, one of which can be MatchStatus.FINISHED
   * This function is used by the `match` to update the `match` state
   * 
   * @param match - The `Match` to update state with `Commands`
   * @param commands - The `Commands` used to update the state in a `Match`
   * @param config - Any user configurations that can be added as parameters
   */
  abstract async update(match: Match, commands: Array<Command>, config?: any): Promise<MatchStatus>

  /**
   * Abstract function required to store the result of a `match`
   * This function is used by the `match` to update the results stored in the `match`
   * 
   * @param match - The `Match` used to process results
   * * @param config - Any user configurations that can be added as parameters
   */
  abstract async storeResults(match: Match, config?: any): Promise<boolean>

}

// Standard ways for commands from agents to be streamed to `MatchEngine` for the `Design` to handle
export enum COMMAND_STREAM_TYPE {
	PARALLEL, // first come first serve for commands run, leads to all Agents sending commands based on old states
	SEQUENTIAL // each agent's set of command sequence is run before the next agent
};
export type CommandSequence = {
  commands: Array<string>
  agentID: agentID
}
export type Command = {
  command: string // string containing a single command
  agentID: agentID
}
export type DesignOptions = {
  commandStreamType: COMMAND_STREAM_TYPE
  commandDelimiter: string
};
