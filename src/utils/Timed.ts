import { EventEmitter } from "events";
import { noop } from ".";

export interface TimedConfigs {
  time: {
    perStep: number,
    overage: number,
  }
}
export enum Events {
  TIMEOUT = 'timeout',
  ERROR = 'error'
}
/**
 * Class to time functions and reject and handle errors should the timer go off.
 */
export class Timed extends EventEmitter {
  _clearTimer: Function = noop;
  /** Function to call so that timed functions which are hanging and going over limits throw an error and exit */
  _rejectTimer: Function = noop;
  public remainingOverage = 60000;
  public currentTimeoutReason = 'Unknown';

  constructor(public configs: TimedConfigs) {
    super();
    this.remainingOverage = configs.time.overage;
    if (this._hasTimer()) {
      this.on(Events.TIMEOUT, () => {
        this._rejectTimer();
      });
    }
    this.on(Events.ERROR, () => {
      this._rejectTimer();
    });
  }
  _setTimeout(fn: Function, delay: number, ...args: any[]): void {
    const timer = setTimeout(() => {
      fn(...args);
    }, delay);
    const startTime = performance.now();
    this._clearTimer = () => {
      clearTimeout(timer);
      return performance.now() - startTime;
    };
  }

  _hasTimer(): boolean {
    return this.configs.time.perStep !== null;
  }

  public async run<T>(fn: (...args: any[]) => Promise<T>): Promise<T> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (res, rej) => {
      if (this._hasTimer()) {
        this._setTimeout(() => {
          this.emit(Events.TIMEOUT, this.configs.time.perStep + this.remainingOverage);
        }, this.configs.time.perStep + this.remainingOverage);
      }
      this._rejectTimer = rej;
      try {
        const output = await fn();
        const elpasedTime = this._clearTimer();
        if (this._hasTimer()) {
          if (elpasedTime > this.configs.time.perStep) {
            this.remainingOverage -= elpasedTime - this.configs.time.perStep;
          }
          if (this.remainingOverage < 0) {
            // this usually shouldn't happen as this will be caught out by the timer above, but if so, emit the timeout event
            this.emit(Events.TIMEOUT);
          }
        }
        this.currentTimeoutReason = 'Unknown';
        res(output);
      } catch (err) {
        this.emit(Events.ERROR, `${this.currentTimeoutReason}`, err);
        rej(err);
      } finally {
        this._clearTimer();
      }
    });
  }
}