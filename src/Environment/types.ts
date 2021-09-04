export type AgentActions = Array<{
  action: string | number | number[];
}>
export type RenderModes = 'web' | 'ansi';
export enum CallTypes {
  STEP = 'step',
  RESET = 'reset',
  RENDER = 'render',
  CLOSE = 'close',
  INIT = 'init'
}