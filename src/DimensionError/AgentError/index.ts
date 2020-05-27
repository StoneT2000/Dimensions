import { nanoid } from "../..";

const AGENT_ERROR = 'AgentError';
const AGENT_INSTALL_ERROR = 'AgentInstallError';
const AGENT_INSTALL_TIMEOUT_ERROR = 'AgentInstallTimeoutError';

const AGENT_COMPILE_ERROR = 'AgentCompileError';
const AGENT_COMPILE_TIMEOUT_ERROR = 'AgentCompileTimeoutError';

const AGENT_FILE_ERROR = 'AgentFileError';
const AGENT_DIRECTORY_ERROR = 'AgentDirectoryError';

const AGENT_MISSING_ID_ERROR = 'AgentMissingIDError';

/**
 * Any errors thrown by the {@link Agent} class
 */
export class AgentError extends Error {
  /**
   * The id of the {@link Agent} that caused the error. If it is -1, then there is no one specific 
   * agent that caused the agent error
   */
  public agentID = -1;
  constructor(m: string, agentID: number) {
    super(m);
    this.agentID = agentID;
    this.name = AGENT_ERROR;
    Object.setPrototypeOf(this, AgentError.prototype);
  }
}

/**
 * Errors thrown during the install step of an {@link Agent}. The install step is when we run the `install.sh` file if
 * provided to run any necessary installation to setup the bot
 */
export class AgentInstallError extends AgentError {
  constructor(m: string, agentID: number) {
    super(m, agentID);
    this.name = AGENT_INSTALL_ERROR;
    Object.setPrototypeOf(this, AgentInstallError.prototype);
  }
}

/**
 * An error thrown when an Agent's install step times out
 */
export class AgentInstallTimeoutError extends AgentInstallError {
  constructor(m: string, agentID: number) {
    super(m, agentID);
    this.name = AGENT_INSTALL_TIMEOUT_ERROR;
    Object.setPrototypeOf(this, AgentInstallTimeoutError.prototype);
  }
}

/**
 * Errors thrown during the compile step of an {@link Agent}. The compile step is when we run something such as 
 * `javac Bot.java`.
 */

export class AgentCompileError extends AgentError {
  constructor(m: string, agentID: number) {
    super(m, agentID);
    this.name = AGENT_COMPILE_ERROR;
    Object.setPrototypeOf(this, AgentCompileError.prototype);
  }
}
/**
 * An error thrown when an Agent's compile step times out
 */
export class AgentCompileTimeoutError extends AgentCompileError {
  constructor(m: string, agentID: number) {
    super(m, agentID);
    this.name = AGENT_COMPILE_TIMEOUT_ERROR;
    Object.setPrototypeOf(this, AgentCompileTimeoutError.prototype);
  }
}

/**
 * An error thrown when an Agent is supplied with an invalid file
 */
export class AgentFileError extends AgentError {
  constructor(m: string, agentID: number) {
    super(m, agentID);
    this.name = AGENT_FILE_ERROR;
    Object.setPrototypeOf(this, AgentFileError.prototype);
  }
}

/**
 * An error thrown when an Agent is supplied with an invalid file
 */
export class AgentDirectoryError extends AgentError {
  constructor(m: string, agentID: number) {
    super(m, agentID);
    this.name = AGENT_DIRECTORY_ERROR;
    Object.setPrototypeOf(this, AgentDirectoryError.prototype);
  }
}

/**
 * An error thrown when an id is not provided to an Agent in the constructor
 */
export class AgentMissingIDError extends AgentError {
  constructor(m: string, agentID: number) {
    super(m, agentID);
    this.name = AGENT_MISSING_ID_ERROR;
    Object.setPrototypeOf(this, AgentMissingIDError.prototype);
  }
}