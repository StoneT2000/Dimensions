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
  time: {
    /**
     * Amount of time in ms an agent is allotted per step. This time is calculated by checking how long it takes for an agent to receive inputs and produce outputs.
     *
     * If set to null, no timer is set
     *
     * @default `2000`
     */
    perStep: number;
    /**
     * Pool of time in ms that is tapped into each step an agent spends more than the time allotted per step
     *
     * @default `60000`
     */
    overage: number;
  };
}

export enum Events {
  TIMEOUT = 'timeout',
  OUTOFMEMORY = 'outofmemory',
  INIT_ERROR = 'init_error',
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
