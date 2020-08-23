import { ChildProcess } from 'child_process';

export const isChildProcess = (p: any): p is ChildProcess => {
  return p ? p.constructor.name === 'ChildProcess' : false;
};
