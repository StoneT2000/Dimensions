import { ChildProcess } from 'child_process';

export const isChildProcess = (p: unknown): p is ChildProcess => {
  return p ? p.constructor.name === 'ChildProcess' : false;
};
