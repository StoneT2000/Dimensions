export type Action = any;
export type AgentActions = Record<string, Action> | Action;
/**
 * Render modes
 *
 * `'ansi'` is for terminal output to be rendered to the terminal directly
 *
 * `'state'` is all the state required to best visualize the environment state
 */
export type RenderModes = 'web' | 'ansi' | 'state';
export enum CallTypes {
  STEP = 'step',
  RESET = 'reset',
  RENDER = 'render',
  CLOSE = 'close',
  INIT = 'init',
  SEED = 'seed',
  REGISTER_AGENTS = 'register_agents',
}


export interface EnvConfigs {
  name?: string;
  /**
   * For python envs, this is just selecting which python interpreter to use
   * 
   * For others, this is selecting what binary/command to use to run a given env file
   */
  command: string;
}
export const EnvConfigs_DEFAULT: EnvConfigs = {
  command: 'python'
}