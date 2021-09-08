import { Agent } from '../../Agent';

const AGENT_ERROR = 'AgentError';

const AGENT_NOT_HANDLING_INPUT_ERROR = 'AgentNotHandlingInputError';

/**
 * Any errors thrown by the {@link Agent} class
 */
export class AgentError extends Error {
  /**
   * The id of the {@link Agent} that caused the error. If it is -1, then there is no one specific
   * agent that caused the agent error
   */
  constructor(m: string, public agent: Agent) {
    super(m);
    if (agent.configs.name !== null) {
      this.message = `[${agent.configs.name} (${agent.id})] ${this.message}`;
    } else {
      this.message = `[${agent.id}] ${this.message}`;
    }
    this.name = AGENT_ERROR;
    Object.setPrototypeOf(this, AgentError.prototype);
  }
}

/**
 * Error is thrown when an agents input stream's internal buffer reaches or execeeds the highWaterMark, indicating the
 * agent is not handling input properly or fast enough for smooth match running.
 */
export class AgentNotHandlingInputError extends AgentError {
  constructor(m: string, public agent: Agent) {
    super(m, agent);
    this.name = AGENT_NOT_HANDLING_INPUT_ERROR;
    Object.setPrototypeOf(this, AgentNotHandlingInputError.prototype);
  }
}
