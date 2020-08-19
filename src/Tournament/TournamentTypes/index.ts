/**
 * Enums for Tournament Types
 */
export enum TournamentType {
  /** {@link RoundRobin} type */
  ROUND_ROBIN = 'round_robin',
  /** {@link Elimination} type */
  ELIMINATION = 'elimination',
  /** {@link Ladder} type */
  LADDER = 'ladder',

  /** Internal use only */
  UNKNOWN = 'unknown_tournament_type',
}