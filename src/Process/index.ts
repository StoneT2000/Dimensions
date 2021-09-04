import { ChildProcess, SpawnOptions } from "child_process";
import spawn from 'cross-spawn';
import { EventEmitter } from "events";
import { Logger } from "../Logger";
import { Events } from "./events";
import { PromiseStructure } from "./types";

/**
 * Generic class that wraps around a process that is spawned and receives input and prints out outputs
 * 
 */
export class Process extends EventEmitter {
  public p: ChildProcess;
  /** internal buffer to store stdout from an agent that has yet to be delimited / used */
  public _buffer: {
    stdout: Array<string>;
    stderr: Array<string>;
  } = {
    stdout: [],
    stderr: []
  };

  public log: Logger = new Logger();

  /**
   * Promise structures allow the Process class to wait for outputs from the underlying process, or otherwise throw an error if something wrong happens
   */
  _promises: {
    stdout: PromiseStructure;
    stderr: PromiseStructure;
  }
  _stdoutPromise: Promise<string>;

  constructor(command: string, args: string[] = [], options?: SpawnOptions) {
    super();
    this._promises = {
      stdout: this._createPromiseStructure(),
      stderr: this._createPromiseStructure()
    }

    this.p = spawn(command, args, options);
    this.p.on('close', (code) => {
      this.emit(Events.CLOSE, code);
    });
    this.p.stdout.on('readable', () => {
      
      let data: Array<string>;
      while ((data = this.p.stdout.read())) {
        // split chunks into line by line and push into buffer
        const strs = `${data}`.split(/\r?\n/);
        for (let i = 0; i < strs.length - 1; i++) {
          this._buffer.stdout.push(strs[i]);
        }
        this._promises.stdout.res(data);
        this._promises.stdout = this._createPromiseStructure();
      }
    });
    this.p.stderr.on('readable', () => {
      
      let data: Array<string>;
      while ((data = this.p.stderr.read())) {
        this.log.custom(`[pid ${this.p.pid}]`.blue, Logger.LEVEL.ERROR, `${data}`);
      }
    });
  }
  _createPromiseStructure(): { promise: Promise<string>; res: Function; rej: Function; } {
    let res: Function;
    let rej: Function;
    const promise = new Promise((_res: (v: string) => void, _rej) => {
      res = _res;
      rej = _rej;
    });
    return {
      promise, res, rej
    }
  }
  async send(message: string): Promise<void> {
    return new Promise((res, rej) => {
      // console.log(this.p.stdin.write)
      this.p.stdin.write(`${message}\n`, (err) => {
          if (err) rej(err);
          else res();
      });
    })
  }
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
      throw RangeError("given fd has to be one of {0, 2}")
    }
    if (arr.length === 0) {
      // await for it to fill up
      await this._promises.stdout.promise;
    }
    return arr.shift();
  }

  /**
   * Attempt to close the process
   */
  async close(): Promise<void> {
    this.p.kill("SIGINT");
  }
}