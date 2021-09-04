import * as DError from "../DimensionError";
import { EventEmitter } from "events";
import { Process } from "../Process";
import { deepMerge } from "../utils/DeepMerge";
import { DeepPartial } from "../utils/DeepPartial";
import { CallTypes, Configs, Events, Status } from "./types";
import fs from 'fs';
import { noop } from "../utils";
import { Logger } from "../Logger";

export class Agent extends EventEmitter {
  public p: Process;
  public id: string = null;
  public status: Status = Status.DONE;
  public configs: Configs = {
    agent: null,
    name: null,
    time: {
      perStep: 2000,
      overage: 0//60000,
    }
  }
  public remainingOverage = 60000;
  
  public log: Logger = new Logger();

  _clearTimer: Function = noop;
  /** Function to call so that timed functions which are hanging and going over limits throw an error and exit */
  _rejectTimer: Function = noop;

  private static globalID = 0;

  private currentTimeoutReason = "Unknown";

  constructor(configs: DeepPartial<Configs> = {}) {
    super();
    this.configs = deepMerge(this.configs, configs);
    if (!this.configs.agent) {
      throw new TypeError("No agent executable provided")
    }
    if (!fs.existsSync(this.configs.agent)) {
      throw new DError.MissingFilesError(`no such file ${this.configs.agent}`);
    }

    this.remainingOverage = this.configs.time.overage;

    this.id = `agent_${Agent.globalID++}`;


  }

  /**
   * Initialize the agent process
   */
  async initialize(): Promise<void> {
    this.p = new Process(this.configs.agent);
    this.p.log.identifier = `[${this.id}]`;
    if (this.configs.name) {
      this.p.log.identifier = `[${this.configs.name} (${this.id})]`
    }
    this.log.identifier = this.p.log.identifier;

    // setup timeout functionality
    if (this._hasTimer()) {
      this.on(Events.TIMEOUT, () => {
        this.log.error(`Timed out, reason: ${this.currentTimeoutReason}`); // TODO also print the time limits
        this._rejectTimer();
        this.status = Status.ERROR;
        this.close();
      });
    }
    if (this._hasMemoryLimits()) {
      this.on(Events.OUTOFMEMORY, () => {
        this.log.error('Out of memory'); // TODO also print the memory limit
        this._rejectTimer();
        this.status = Status.ERROR;
        this.close();
      });
    }

    this.on(Events.INIT_ERROR, (reason: string) => {
      this.log.error('Initialization error', reason);
      this._rejectTimer();
      this.status = Status.ERROR;
      this.close();
    });

    // perform handshake to verify agent is alive
    await this._timed(async () => {
      this.currentTimeoutReason = 'Could not send agent initialization information';
      await this.p.send(JSON.stringify({
        name: this.configs.name,
        id: this.id,
        type: CallTypes.INIT
      }));
      this.currentTimeoutReason = 'Did not receive agent id back from agent during initialization';
      const readid = await this.p.readstdout();
      if (readid !== this.id) {
        this.emit(Events.INIT_ERROR, `Agent responded with wrong id of ${readid} instead of ${this.id} during initialization`)
      }
    });

    // agent is now ready and active!
    this.status = Status.ACTIVE;
  }

  async ready(): Promise<boolean> {
    return this.p !== undefined; // TODO change this
  }

  active(): boolean {
    return this.status === Status.ACTIVE;
  }

  /**
   * Clean up the agent process
   */
  async close(): Promise<void> {
    if (this.active()) {
      await this.p.send(JSON.stringify({
        type: CallTypes.CLOSE
      }))
    }
    await this.p.close(); // TODO, configurable, give agent a certain amount of cooldown before force stopping it
    this.status = Status.DONE;
  }

  /**
   * Setup the agent timer clear out method
   * 
   * clear out method returns the elpased time since the timer was set in nanoseconds (1e-9)
   */
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
  _hasMemoryLimits(): boolean {
    // TODO implement
    return true;
  }

  /** 
   * wrap a function in a time limit, emitting the timeout event should the function exceed the time limits
   * 
   * rejects when an error is thrown by fn or _rejectTimer is called
   */
  async _timed<T>(fn: (...args: any[]) => Promise<T>): Promise<T> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (res, rej) => {
      if (this._hasTimer()) {
        this._setTimeout(() => {
          this.emit(Events.TIMEOUT);
        }, this.configs.time.perStep + this.remainingOverage);
      }
      this._rejectTimer = rej;
      const output = await fn();
      const elpasedTime = this._clearTimer() * 1e-6;
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
    });
  }

  /**
   * Retrieve an action from the agent
   * 
   * @param data - typically the data provided by env.step() functions
   * @returns 
   */
  async action(data: Record<string, any>): Promise<Record<string, any>> {
    try {
      const action = await this._timed(
        async () => {
          this.currentTimeoutReason = 'Agent did not respond with an action in time';
          await this.p.send(JSON.stringify({
            ...data,
            type: CallTypes.ACTION,
          }));
          const action: Record<string, any> = JSON.parse(await this.p.readstdout());
          return action;
        }
      );
      return action;
    } catch {
      return null
    }
  }

  async resume(): Promise<void> {
    return this.p.resume();
  }
  async pause(): Promise<void> {
    return this.p.pause();
  }
}