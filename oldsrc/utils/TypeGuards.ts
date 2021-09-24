import { ChildProcess } from 'child_process';
import { Agent } from '../Agent';

export const isChildProcess = (p: unknown): p is ChildProcess => {
  return p ? p.constructor.name === 'ChildProcess' : false;
};

export class AgentClassTypeGuards {
  /**
   * Type guard for checking if the agent meta data passed in are just file strings
   */
  static isGenerationMetaData_FilesOnly(
    p: unknown
  ): p is Agent.GenerationMetaData_FilesOnly {
    return typeof p[0] === 'string';
  }
  /**
   * Type guard for checking if the agent meta data passed include names and files
   */
  static isGenerationMetaData_CreateMatch(
    p: unknown
  ): p is Agent.GenerationMetaData_CreateMatch {
    return p[0].name !== undefined;
  }

  /**
   * Type guard for checking if the agent meta data passed include names and files and tournament ids
   */
  static isGenerationMetaData_Tournament(
    p: unknown
  ): p is Agent.GenerationMetaData_Tournament {
    return p[0].tournamentID !== undefined;
  }
}
