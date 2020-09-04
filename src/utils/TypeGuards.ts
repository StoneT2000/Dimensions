import { ChildProcess } from 'child_process';
import { Agent } from '../Agent';

export const isChildProcess = (p: unknown): p is ChildProcess => {
  return p ? p.constructor.name === 'ChildProcess' : false;
};

export class AgentClassTypeGuards {
  static isGenerationMetaData_FilesOnly(
    p: unknown
  ): p is Agent.GenerationMetaData_FilesOnly {
    return typeof p[0] === 'string';
  }

  static isGenerationMetaData_CreateMatch(
    p: unknown
  ): p is Agent.GenerationMetaData_CreateMatch {
    return p[0].name !== undefined;
  }

  static isGenerationMetaData_Tournament(
    p: unknown
  ): p is Agent.GenerationMetaData_Tournament {
    return p[0].tournamentID !== undefined;
  }
}
