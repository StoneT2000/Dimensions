const MATCH_DESTROYED_ERROR = 'MatchDestroyedError';
const MATCH_ERROR = 'MatchError';
const MATCH_REPLAY_FILE_ERROR = 'MatchReplayFileError';
const MATCH_ERROR_LOG_FILE_ERROR = 'MatchErrorLogFileError';

/**
 * @class MatchError
 * Errors thrown by the {@link Match} class
 */
export class MatchError extends Error {
  constructor(m: string) {
    super(m);
    this.name = MATCH_ERROR;
    Object.setPrototypeOf(this, MatchError.prototype);
  }
}

/**
 * Error thrown when a match is explicitly destroyed (by the user generally) by calling {@link Match.destroy}
 */
export class MatchDestroyedError extends MatchError {
  constructor(m: string) {
    super(m);
    this.name = MATCH_DESTROYED_ERROR;
    Object.setPrototypeOf(this, MatchDestroyedError.prototype);
  }
}

/**
 * Errors related to replay files
 */
export class MatchReplayFileError extends MatchError {
  constructor(m: string) {
    super(m);
    this.name = MATCH_REPLAY_FILE_ERROR;
    Object.setPrototypeOf(this, MatchReplayFileError.prototype);
  }
}

/**
 * Errors related to log files
 */
export class MatchErrorLogFileError extends MatchError {
  constructor(m: string) {
    super(m);
    this.name = MATCH_ERROR_LOG_FILE_ERROR;
    Object.setPrototypeOf(this, MatchErrorLogFileError.prototype);
  }
}