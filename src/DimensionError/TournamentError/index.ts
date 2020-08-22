const TOURNAMENT_ERROR = 'TournamentError'
const TOURNAMENT_PLAYER_DOES_NOT_EXIST_ERROR = 'TournamentPlayerDoesNotExistError'
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

/**
 * Errors thrown by the {@link Tournament} class
 * 
 * Usually won't halt a tournament, but indicate something was uncompleted as a result of an error
 */
export class TournamentPlayerDoesNotExistError extends TournamentError {
  constructor(m: string) {
    super(m);
    this.name = TOURNAMENT_PLAYER_DOES_NOT_EXIST_ERROR
    Object.setPrototypeOf(this, TournamentPlayerDoesNotExistError.prototype);
  }
}
