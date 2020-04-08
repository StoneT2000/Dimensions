import { MatchEngine } from "../MatchEngine";
import { deepMerge } from "../utils/DeepMerge";
import { DeepPartial } from "../utils/DeepPartial";
import { Agent } from "../Agent";
import { Match } from "../Match";
import { Logger } from "../Logger";
import EngineOptions = MatchEngine.EngineOptions;
import COMMAND_FINISH_POLICIES = MatchEngine.COMMAND_FINISH_POLICIES;
import COMMAND_STREAM_TYPE = MatchEngine.COMMAND_STREAM_TYPE;
import Command = MatchEngine.Command;

/**
 * @class Design
 * @classdesc Abstract class detailing a Design to be used as the platform that holds match lifecycle logic for
 * updating and manipulating ongoing matches
 * 
 * Refer to {@link Match} class and the {@link Agent} for exposed fields available for user's use when making your own 
 * Design
 * 
 * The important functions to implement are {@link initialize}, {@link update}, and {@link getResults}
 * 
 */
export abstract class Design {
  
  // The standard defaults
  private _ABSTRACT_DEFAULT_DESIGN_OPTIONS: DesignOptions = {
    engineOptions: {
      commandStreamType: COMMAND_STREAM_TYPE.SEQUENTIAL,
      commandDelimiter: ',',
      commandFinishSymbol: 'D_FINISH',
      commandFinishPolicy: COMMAND_FINISH_POLICIES.FINISH_SYMBOL,
      commandLines: {
        max: 1,
        // min: 1
        waitForNewline: true
      },
      timeout: {
        max: 1000,
        active: true,
        timeoutCallback: (agent: Agent, match: Match, engineOptions: EngineOptions) => {
          match.kill(agent.id);
          match.log.error(`agent ${agent.id} - '${agent.name}' timed out after ${engineOptions.timeout.max} ms`);
        }
        /**
         * (agent: Agent, match: Match) => {
         *   agent.finish();
         * }
         */
      }
    }
  }

  /** The current design options */
  protected designOptions: DesignOptions;

  /** Logger */
  public log = new Logger();

  /**
   * Design constructor
   * @param name - The name of the design
   * @param designOptions - The options for this design
   */
  constructor(public name: String, designOptions: DeepPartial<DesignOptions> = {}) {

    // Set defaults from the abstract class
    this.designOptions = {... this._ABSTRACT_DEFAULT_DESIGN_OPTIONS};

    // Override with user provided params
    deepMerge(this.designOptions, designOptions);
    // Object.assign(this.designOptions, designOptions);
    this.log.detail(`Design + MatchEngine Options`, this.designOptions);
    // Set log level to default
    this.log.level = Logger.LEVEL.INFO;
    this.log.system(`Initialized Design: ` + this.name);
  }

  /**
   * Set log level of the design
   * @param level - level to set design logger to
   */
  _setLogLevel(level: Logger.LEVEL) {
    this.log.level = level;
  }
  
  /**
   * Get the design options associated with this `Design`
   */
  getDesignOptions() : DesignOptions {
    return this.designOptions;
  }

  /**
   * Abstract function required to initialize match state and send relevant information to 
   * agents participating in the match
   * @see {@link Agent} for what properties and methods related to agents are exposed to the user for use.
   * @see {@link Match} for what properties and methods are exposed to the user for use e.g match.send() and match.state
   * 
   * @param match - The {@link Match} to initialize state with
   * @returns Nothing needed, return result is not used by `match`
   */
  abstract async initialize(match: Match): Promise<void>

  /**
   * Abstract function required to update match state with commands from Agents and send commands to Agents
   * along with returning the current match status. Returning Match.Status.RUNNING indicates the match is not done yet. 
   * Returning MatchStatus.FINISHED indicates the match is over.
   * 
   * @see {@link Match} - This function is used by the match to update the match state and move forward a time step
   * @see {@link Agent} for what properties and methods related to agents are exposed to the user for use.
   * @see {@link Match.Status} for different statuses you can return.
   * 
   * @param match - The Match to update state with the given Commands
   * @param commands - The {@link MatchEngine.Command} array used to update the state in a Match. 
   *                   Each element has two keys, command and agentID. agentID is the id of the agent that outputted
   *                   that string in command
   * @returns A promise that resolves with the current {@link Match.Status} at the end of this time step. Can also 
   * directly just return the match status
   */
  abstract async update(match: Match, commands: Array<Command>): Promise<Match.Status>

  /**
   * Abstract function required to get the result of a {@link Match}.
   * 
   * @see {@link Match} - This function is used by the match to update the results stored in the match and return
   * results
   * 
   * @param match - The `Match` used to process results
   * @param config - Any user configurations that can be added as parameters
   * @returns A promise that resolves with results (can be an object, number, anything). Can also directly just return 
   *          the results
   */
  abstract async getResults(match: Match): Promise<any>

}

/**
 * Design options
 */
export interface DesignOptions {
  /** The default engine options to use for all matches created using this design */
  engineOptions: EngineOptions
};
