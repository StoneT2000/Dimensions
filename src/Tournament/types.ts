export enum TOURNAMENT_TYPE {
  /** {@link RoundRobinTournament} type */
  ROUND_ROBIN = 'round_robin',
  /** {@link EliminationTournament} type */
  ELIMINATION = 'elimination',
  /** {@link LadderTournament} type */
  LADDER = 'ladder', // like halite
}
export enum TournamentStatus {
  /** Status when tournament was just called with new */
  UNINITIALIZED = 'uninitialized',
  /** Tournmanet is ready to run with {@link Tournament.run} */
  INITIALIZED = 'initialized',
  /** Tournmanet is currently stopped */
  STOPPED = 'stopped',
  /** Tournmanet is running */
  RUNNING = 'running',
  /** Tournmanet crashed some how */
  CRASHED = 'crashed',
  /** Tournament is done */
  FINISHED = 'finished'
}