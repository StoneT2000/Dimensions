export type AgentActions = Array<{
  action: string | number | number[];
}>
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
  SEED = 'seed'
}