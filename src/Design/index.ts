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
 * @classdesc Abstract class detailing a `Design` to be used as the platform that holds match lifecycle logic for
 * updating and manipulating ongoing `matches`
 * 
 * Refer to `Match` class and the `Agent` for exposed fields available for user's use
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

  protected designOptions: DesignOptions;
  public log = new Logger();
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
   * Abstract function required to initialize `match` state and the `agents` participating in the `match`
   * @see Agents for what properties and methods related to `agents` are exposed to the user for use.
   * @see Match for what properties and methods are exposed to the user for use e.g match.send() and match.state
   * 
   * @param match - The `Match` to initialize state with
   * @param config - Any user configurations that can be added as parameters @see MatchConfigs
   * @returns Nothing needed, return result is not used by `match`
   */
  abstract async initialize(match: Match, config?: any): Promise<void>

  /**
   * Abstract function required to update `match` state with commands from Agents and send commands to Agents
   * along with returning the current match status, one of which can be {@link Match.Status.FINISHED}
   * 
   * @see Match - This function is used by the `match` to update the `match` state and move forward a time step
   * 
   * @param match - The `Match` to update state with `Commands`
   * @param commands - The `Commands` array used to update the state in a `Match`. 
   *                   Each element has two keys, command and agentID. agentID is the id of the agent that outputted
   *                   that string in command
   * @param config - Any user configurations that can be added as parameters
   * @returns A promise that resolves with the current `Match.Status` at the end of this time step. Can also directly 
   *          just return `Match.Status`
   */
  abstract async update(match: Match, commands: Array<Command>, config?: any): Promise<Match.Status>

  /**
   * Abstract function required to get the result of a `match`
   * 
   * @see Match - This function is used by the `match` to update the results stored in the `match` and return results
   * 
   * @param match - The `Match` used to process results
   * @param config - Any user configurations that can be added as parameters
   * @returns A promise that resolves with results (can be an object, number, anything). Can also directly just return 
   *          the results
   */
  abstract async getResults(match: Match, config?: any): Promise<any>

}

export interface DesignOptions {
  engineOptions: EngineOptions
};
