import { SpawnOptions } from 'child_process';
import { EventEmitter } from 'events';
import { Logger } from '../Logger';
import { ProcessOptions, PromiseStructure } from './types';
import { DeepPartial } from '../utils/DeepPartial';
import { deepMerge } from '../utils/DeepMerge';

/**
 * Generic class that wraps around a process that is spawned and receives input and prints out outputs
 *
 */
export abstract class Process extends EventEmitter {
  /** internal buffer to store stdout from an agent that has yet to be delimited / used */
  public _buffer: {
    stdout: Array<string>;
    stderr: Array<string>;
  } = {
    stdout: [],
    stderr: [],
  };

  public log: Logger = new Logger();

  /**
   * Promise structures allow the Process class to wait for outputs from the underlying process, or otherwise throw an error if something wrong happens
   */
  _promises: {
    stdout: PromiseStructure;
    stderr: PromiseStructure;
  };
  _stdoutPromise: Promise<string>;



  public processOptions: ProcessOptions = {
    time: {
      perStep: 2000,
      overage: 60000,
    },
  };

  /** keep track of all processes for cleanup purposes. Maps pid to process object */
  static allProcesses: Map<number, Process> = new Map();
  
  constructor(public command: string, public args: string[] = [], options?: SpawnOptions, processOptions?: DeepPartial<ProcessOptions>) {
    super();
    this.processOptions = deepMerge(this.processOptions, processOptions);
    this._promises = {
      stdout: this._createPromiseStructure(),
      stderr: this._createPromiseStructure(),
    };
  }
  abstract init(): Promise<void>;
  abstract send(message: string): Promise<void>;

  async readstdout(): Promise<string> {
    return this.readline(0);
  }
  async readstderr(): Promise<string> {
    return this.readline(2);
  }
  /**
   * Read a line from stdout and stderr
   */
  async readline(fd: 0 | 2 = 0): Promise<string> {
    let arr = [];
    if (fd == 0) {
      arr = this._buffer.stdout;
    } else if (fd == 2) {
      arr = this._buffer.stderr;
    } else {
      throw RangeError('given fd has to be one of {0, 2}');
    }
    if (arr.length === 0) {
      // await for it to fill up
      await this._promises.stdout.promise;
    }
    return arr.shift();
  }
  _createPromiseStructure(): {
    promise: Promise<string>;
    res: Function;
    rej: Function;
  } {
    let res: Function;
    let rej: Function;
    const promise = new Promise((_res: (v: string) => void, _rej) => {
      res = _res;
      rej = _rej;
    });
    return {
      promise,
      res,
      rej,
    };
  }

  /**
   * Attempt to close the process
   */
  abstract close(): Promise<void>;

  /**
   * Pauses the process
   */
  abstract pause(): Promise<void>;
  /**
   * Resumes the process
   */
  abstract resume(): Promise<void>;

  /**
   * Close all processes and clean them up
   */
  static async _closeAllProcesses(): Promise<void> {
    await Promise.all(
      Array.from(Process.allProcesses.values()).map((p) => p.close())
    );
  }
}
