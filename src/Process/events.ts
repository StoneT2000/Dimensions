export enum Events {
  /**
   * Event emitted by {@link Process} when memory limit is exceeded
   */
  EXCEED_MEMORY_LIMIT = 'proc_exceedMemoryLimit',
  /**
   * Event emitted by {@link Process} when it times out.
   */
  TIMEOUT = 'proc_timeout',
  /**
   * event emitted when associated process or container for process closes and is terminated
   */
  EXIT = 'proc_exit',
}
