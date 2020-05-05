const TOURNAMENT_ERROR = 'TournamentError'
/**
 * Errors thrown by the {@link Tournament} class
 * 
 * Usually won't halt a tournament, but indicate something was uncompleted as a result of an error
 */
export class TournamentError extends Error {
  constructor(m: string) {
    super(m);
    this.name = TOURNAMENT_ERROR
    Object.setPrototypeOf(this, TournamentError.prototype);
  }
}
