import { MatchEngine } from ".";
import { Match } from "../Match";
import { Agent } from "../Agent";

/**
 * Engine Options that specify how the MatchEngine should operate on a {@link Match}
 */
export interface EngineOptions {
  /** The command streaming type */
  commandStreamType: MatchEngine.COMMAND_STREAM_TYPE,
  /** 
   * Delimiter for seperating commands from agents in their stdout and then sending these delimited commands to
   * {@link Design.update}. If an agent sent `move a b 3,run 24 d,t 3` and the delimiter is `','` then the 
   * {@link Design.update} function will receive commands `'move a b 3'` and `'run 24 d'` and `'t 3'`
   * @default ','
   */
  commandDelimiter: string, 
  /** 
   * The finish symbol to use 
   * @default 'D_FINISH'
   */
  commandFinishSymbol: string,
  /** 
   * Which kind of command finishing policy to use 
   * @default 'finish_symbol'
   */
  commandFinishPolicy: MatchEngine.COMMAND_FINISH_POLICIES,
  /** 
   * Options for the {@link COMMAND_FINISH_POLICIES.LINE_COUNT} finishing policy. Used only if this policy is active
   */
  commandLines: {
    /** 
     * Maximum lines of commands delimited by new line characters '\n' allowed before engine cuts off an Agent 
     * @default 1
     */
    max: number,
    /** 
     * Whether the engine should wait for a newline character before processing the line of commands received 
     * This should for most cases be set to `true`; false will lead to some unpredictable behavior.
     * @default true
     */
    waitForNewline: boolean
  }

  /** 
   * Options for timeouts of agents 
   */
  timeout: {
    /** 
     * On or not 
     * @default true 
     */
    active: boolean,
    /** 
     * How long in milliseconds each agent is given before they are timed out and the timeoutCallback 
     * function is called
     * @default 1000
     */
    max: number,
    /** 
     * the callback called when an agent times out. 
     * Default is kill the agent with {@link Match.kill}.
     */
    timeoutCallback: 
    /** 
     * @param agent the agent that timed out
     * @param match - the match the agent timed out in
     * @param engineOptions - a copy of the engineOptions used that timed out the agent
     */
      (agent: Agent, match: Match, engineOptions: EngineOptions) => void
  }
}