import * as DError from "../DimensionError";
import { EventEmitter } from "events";
import { Process } from "../Process";
import { deepMerge } from "../utils/DeepMerge";
import { DeepPartial } from "../utils/DeepPartial";
import { Configs, Events } from "./types";
import fs from 'fs';
import { noop } from "../utils";
import { Dimension } from "../Dimension";

export class Agent extends EventEmitter {
  public p: Process;
  public id: string = null;
  public configs: Configs = {
    agent: null,
    name: 'default_agent',
    time: {
      perStep: 2000,
      overage: 60000,
    }
  }
  public remainingOverage = 60000;
  
  _clearTimer: Function = noop;

  private static globalID = 0;

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
  }
  /**
   * Clean up the agent process
   */
  async close(): Promise<void> {
    await this.p.close();
  }

  /**
   * Setup the agent timer clear out method
   * 
   * clear out method returns the elpased time since the timer was set in nanoseconds (1e-9)
   */
   _setTimeout(fn: Function, delay: number, ...args: any[]): void {
     process.hrtime
    const timer = setTimeout(() => {
      fn(...args);
    }, delay);
    const startTime = process.hrtime()[1];
    this._clearTimer = () => {
      clearTimeout(timer);
      return process.hrtime()[1] - startTime;
    };
  }

  /**
   * Retrieve an action from the agent
   * 
   * @param stepReturnVal - return value from the environment step function
   * @returns 
   */
  async action(stepReturnVal: string): Promise<string> {
    // measure timer here!
    this._setTimeout(() => {
      this.emit(Events.TIMEOUT);
    }, this.configs.time.perStep + this.remainingOverage);
    await this.p.send(stepReturnVal);
    const action = await this.p.readstdout();
    const elpasedTime = this._clearTimer();
    if (elpasedTime > this.configs.time.perStep) {
      this.remainingOverage -= elpasedTime - this.configs.time.perStep;
    }
    if (this.remainingOverage < 0) {
      // this usually shouldn't happen as this will be caught out by the timer above, but if so, emit the timeotu event
      this.emit(Events.TIMEOUT);
    }
    return action;
  }
}