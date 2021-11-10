import { ChildProcess } from 'child_process';
import treeKill from 'tree-kill';
import { Process } from '.';
import spawn from 'cross-spawn';
import { Logger } from '../Logger';
import { ProcessOptions } from './types';
import { DeepPartial } from '../utils/DeepPartial';
import os from 'os';

/**
 * A LocalProcess to interact with easily.
 */
export class LocalProcess extends Process {
  public p: ChildProcess;
  constructor(
    public command: string,
    public args: string[] = [],
    options?: DeepPartial<ProcessOptions>
  ) {
    super(command, args, options);
  }
  async init(): Promise<void> {
    this.p = spawn(this.command, this.args, {});

    Process.allProcesses.set(this.p.pid, this);

    this.log.identifier = `[pid ${this.p.pid}]`;
    this.p.on('exit', (code) => {
      if (code) {
        // some failure occurred.
        this.log.error(`Process exited with code ${code}`);
      }
    });
    // this.p.on('close', (code) => {
    //   if (code) {
    //     // some failure occurred.
    //     this.log.error(`Process closed with code ${code}`);
    //   }
    // });
    this.p.stdout.on('readable', () => {
      let data: Array<string>;
      while ((data = this.p.stdout.read())) {
        // split chunks into line by line and push into buffer
        const strs = `${data}`.split(/\r?\n/);
        for (let i = 0; i < strs.length - 1; i++) {
          this._buffer.stdout.push(strs[i]);
        }
        // resolve stdout promise to unblock anyone calling readstdout
        this._promises.stdout.res(data);
        this._promises.stdout = this._createPromiseStructure();
      }
    });
    this.p.stderr.on('readable', () => {
      let data: Array<string>;
      while ((data = this.p.stderr.read())) {
        this.log.custom(
          this.log.identifier.blue,
          Logger.LEVEL.ERROR,
          `${data}`
        );
      }
    });
  }
  async send(message: string): Promise<void> {
    return new Promise((res, rej) => {
      this.p.stdin.write(`${message}\n`, (err) => {
        if (err) rej(err);
        else res();
      });
    });
  }
  async close(): Promise<void> {
    return new Promise((res, rej) => {
      this.p.kill('SIGKILL');
      treeKill(this.p.pid, (err) => {
        if (err) {
          rej(err);
        } else {
          res();
          Process.allProcesses.delete(this.p.pid);
        }
      }); // TODO check how this works on windows
    });
  }
  /**
   * Pauses the process
   */
  async pause(): Promise<void> {
    if (os.platform() === 'win32') return; // TODO - can we pause a process on windows?
    this.p.kill('SIGSTOP');
  }
  /**
   * Resumes the process
   */
  async resume(): Promise<void> {
    if (os.platform() === 'win32') return; // TODO - can we resume a paused process on windows?
    this.p.kill('SIGCONT');
  }
}
