export type AgentsActions = Array<{
  actions: string;
}>
export type RenderModes = 'web' | 'ansi';
export enum CallTypes {
  STEP = 'step',
  RESET = 'reset',
  RENDER = 'render',
  CLOSE = 'close',
  INIT = 'init'
}