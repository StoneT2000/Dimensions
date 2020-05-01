const MATCH_DESTROYED_ERROR = 'MatchDestroyedError';
const MATCH_ERROR = 'MatchError';
const MATCH_WARN = 'MatchWarn';
const DIMENSION_ERROR = 'DimensionError';
const FATAL_ERROR = 'FatalError';
const TOURNAMENT_ERROR = 'TournamentError'
/**
 * @class MatchError
 * Standard Match Errors that do not stop a game, but signal to user of some kind of warning or error that
 * occured as a result
 */
export class MatchError extends Error {
  constructor(m: string) {
    super(m);
    this.name = MATCH_ERROR;
    
    /**
     * See https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
     * for why we use this setPrototypeOf workaround. 
     * This is so we can nicer instanceof syntax instead of user defined type guards
     */
    Object.setPrototypeOf(this, MatchError.prototype);
  }
}
/**
 * @class MatchDestroyedError
 * Error thrown when a match is explicitly destroyed (by the user generally)
 */
export class MatchDestroyedError extends MatchError {
  constructor(m: string) {
    super(m);
    this.name = MATCH_DESTROYED_ERROR;
    Object.setPrototypeOf(this, MatchDestroyedError.prototype);
  }
}

/**
 * @class MatchWarn
 * Standard Match Warnings that do not stop a game, but signal to user of some kind of warning or error that
 * occured as a result
 */
export class MatchWarn extends Error {
  constructor(m: string) {
    super(m);
    this.name = MATCH_WARN
    Object.setPrototypeOf(this, MatchWarn.prototype);
  }
}


/**
 * @class MatchWarn
 * Standard Tournament errors that won't halt a tournament, but indicate something was uncompleted as a result of an 
 * error
 */
export class TournamentError extends Error {
  constructor(m: string) {
    super(m);
    this.name = TOURNAMENT_ERROR
    Object.setPrototypeOf(this, TournamentError.prototype);
  }
}

/**
 * @class DimensionError
 * Simple, standard errors reported by the Dimension framework that don't stop the process
 */
export class DimensionError extends Error {
  constructor(m: string) {
    super(m);
    this.name = DIMENSION_ERROR;
    Object.setPrototypeOf(this, DimensionError.prototype);
  }
}

/**
 * @class FatalError
 * @classdesc A fatal error that caused the Dimension framework to break. When thrown, this should stop the process
 */
export class FatalError extends Error {
  constructor(m: string) {
    super(m);
    this.name = FATAL_ERROR;
    Object.setPrototypeOf(this, FatalError.prototype);
  }
}