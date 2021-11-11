import { DockerProcessOptions, ProcessOptions } from '../Process/types';

export interface Configs {
  /**
   * Should be an executable that can run, receive inputs and print actions
   */
  agent: string;
  /**
   * Display name of this agent. When null, display name is not used
   *
   * @default `null`
   */
  name: string;
  /**
   * Where the agent is being run. Can be local, docker, or remote
   *
   * @default `local`
   */
  location: 'local' | 'docker' | 'remote';

  processOptions?: ProcessOptions | DockerProcessOptions;
}

export enum Events {
  TIMEOUT = 'agent_timeout',
  /**
   * For other kinds of errors where there are error objects
   *
   * First arg is any string, second arg is error object
   */
  ERROR = 'agent_error',
  OUTOFMEMORY = 'agent_outofmemory',
  INIT_ERROR = 'agent_init_error',
}

export enum CallTypes {
  INIT = 'init',
  ACTION = 'action',
  CLOSE = 'close',
}

export enum Status {
  /** When the agent process is running and ready to receive inputs and print outputs */
  ACTIVE = 'active',
  /** When the agent crashes abruptly or goes over time limits or memory limis*/
  ERROR = 'error',
  /** When an agent is finished and closed */
  DONE = 'done',
}
