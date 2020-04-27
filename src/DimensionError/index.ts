const MATCH_DESTROYED_ERROR = 'MatchDestroyedError';
const MATCH_ERROR = 'MatchError';
export const isMatchDestroyedError = (err: Error): err is MatchDestroyedError => {
  return (<MatchDestroyedError>err).name === MATCH_DESTROYED_ERROR;
}

/**
 * @class MatchError
 * @classdesc Standard Match Errors that do not stop a game, but signal to user of some kind of warning or error that
 *            occured as a result
 */
export class MatchError extends Error {
  constructor(m: string) {
    super(m);
    this.name = MATCH_ERROR;
  }
}

export class MatchDestroyedError extends MatchError {
  constructor(m: string) {
    super(m);
    this.name = MATCH_DESTROYED_ERROR;
  }
}

/**
 * @class MatchWarn
 * @classdesc Standard Match Warnings that do not stop a game, but signal to user of some kind of warning or error that
 *            occured as a result
 */
export class MatchWarn extends Error {
  constructor(m: string) {
    super(m);
    this.name = "Dimension.MatchWarning"
  }
}

/**
 * @class DimensionError
 * @classdesc Simple, standard errors reported by the Dimension framework
 */
export class DimensionError extends Error {
  constructor(m: string) {
    super(m);
    this.name = "Dimension.Error"
  }
}

/**
 * @class FatalError
 * @classdesc A fatal error that caused the Dimension framework to break. Always thrown and should stop the process
 */
export class FatalError extends Error {
  constructor(m: string) {
    super(m);
    this.name = "Dimension.FatalError"
  }
}