import { EventEmitter } from 'events';
import { Logger } from '../Logger';
import { ProcessOptions, PromiseStructure } from './types';
import { DeepPartial } from '../utils/DeepPartial';
import { deepMerge } from '../utils/DeepMerge';
import * as Timed from '../utils/Timed';
import { Events } from './events';

/**
 * Generic class that wraps around a process that is spawned and receives input and prints out outputs
 * 
 * Auto times any action performed with the process and will reject should it timeout or exit prematurely
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

  public options: ProcessOptions = {
    time: {
      perStep: 2000,
      overage: 60000,
    },
    memory: {
      // 1073741824 = 1024^3 = 1 GB
      limit: 1073741824,
    },
  };

  /** keep track of all processes for cleanup purposes. Maps pid to process object */
  static allProcesses: Map<number | string, Process> = new Map();

  public timed: Timed.Timed;

  constructor(
    public command: string,
    public args: string[] = [],
    options?: DeepPartial<ProcessOptions>
  ) {
    super();
    this.options = deepMerge(this.options, options);
    this._promises = {
      stdout: this._createPromiseStructure(),
      stderr: this._createPromiseStructure(),
    };
    this.timed = new Timed.Timed({
      time: this.options.time,
    });

    this.on(Events.EXIT, (code) => {
      // if the process exits prematurely and with an error, we print the following
      if (code) {
        this.timed.emit(Timed.Events.ERROR, `process exited with code ${code}`, 'check logging for this process for more details')
        this.timed._clearTimer();
      }
    });
  }
  async init(): Promise<void> {
    return this.timed.run(this._init.bind(this));
  }
  abstract _init(): Promise<void>;

  async send(message: string): Promise<void> {
    return this.timed.run(this._send.bind(this), message);
  }
  abstract _send(message: string): Promise<void>;

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
    return this.timed.run(async () => {
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
    });
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
  async close(): Promise<void> {
    return this._close();
  }
  abstract _close(): Promise<void>;

  /**
   * Pauses the process
   */
  async pause(): Promise<void> {
    return this._pause();
  }
  abstract _pause(): Promise<void>;
  /**
   * Resumes the process
   */
  async resume(): Promise<void> {
    return this._resume();
  }
  abstract _resume(): Promise<void>;

  /**
   * Close all processes and clean them up
   */
  static async _closeAllProcesses(): Promise<void> {
    await Promise.all(
      Array.from(Process.allProcesses.values()).map((p) => p.close())
    );
  }
}