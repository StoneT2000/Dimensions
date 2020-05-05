/**
 * This file exports all error classes related to Dimensions
 */
const MATCH_WARN = 'MatchWarn';
const DIMENSION_ERROR = 'DimensionError';
const FATAL_ERROR = 'FatalError';
const NOT_SUPPORTED_ERROR = 'NotSupportedError';
const SECURITY_ERROR = 'SecurityError';
const MISSING_FILES_ERROR = 'MissingFilesError';

/**
 * @class DimensionError
 * Simple, standard errors reported by the Dimension framework that don't stop the process
 */
export class DimensionError extends Error {
  constructor(m: string) {
    super(m);
    this.name = DIMENSION_ERROR;

    /**
     * See https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
     * for why we use this setPrototypeOf workaround. 
     * This is so we can use the `instanceof` syntax instead of user defined type guards
     */
    Object.setPrototypeOf(this, DimensionError.prototype);
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
 * @class FatalError
 * @classdesc A generic fatal error that caused the Dimension framework to break. When thrown, this should stop the 
 * process
 */
export class FatalError extends Error {
  constructor(m: string) {
    super(m);
    this.name = FATAL_ERROR;
    Object.setPrototypeOf(this, FatalError.prototype);
  }
}

/**
 * Error thrown whenever a set of files is required but is found to be missing
 */
export class MissingFilesError extends FatalError {
  constructor(m: string) {
    super(m);
    this.name = MISSING_FILES_ERROR;
    Object.setPrototypeOf(this, MissingFilesError.prototype);
  }
}

/**
 * An error thrown whenever something being used is not supported at the moment;
 */
export class NotSupportedError extends FatalError {
  constructor(m: string) {
    super(m);
    this.name = NOT_SUPPORTED_ERROR;
    Object.setPrototypeOf(this, NotSupportedError.prototype);
  }
}

/**
 * Errors thrown that are related to the security of the dimension
 */
export class SecurityError extends Error {
  constructor(m: string) {
    super(m);
    this.name = SECURITY_ERROR;
    Object.setPrototypeOf(this, SecurityError.prototype);
  }
}

export * from './AgentError';
export * from './MatchError';
export * from './TournamentError';