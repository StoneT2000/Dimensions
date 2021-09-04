import * as DError from "../DimensionError";
import { EventEmitter } from "events";
import { Process } from "../Process";
import { deepMerge } from "../utils/DeepMerge";
import { DeepPartial } from "../utils/DeepPartial";
import { CallTypes, Configs, Events } from "./types";
import fs from 'fs';
import { noop } from "../utils";

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
    await this.p.send(JSON.stringify({
      type: CallTypes.CLOSE
    }))
    await this.p.close(); // TODO, configurable, give agent a certain amount of cooldown before force stopping it
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

  hasTimer(): boolean {
    return this.configs.time.perStep !== null;
  }

  /**
   * Retrieve an action from the agent
   * 
   * @param stepReturnVal - return value from the environment step function
   * @returns 
   */
  async action(stepReturnVal: Record<string, any>): Promise<any> {
    // measure timer here!
    if (this.hasTimer()) {
      this._setTimeout(() => {
        this.emit(Events.TIMEOUT);
      }, this.configs.time.perStep + this.remainingOverage);
    }
    await this.p.send(JSON.stringify({
      ...stepReturnVal,
      type: CallTypes.ACTION,
    }));
    const action = JSON.parse(await this.p.readstdout());
    const elpasedTime = this._clearTimer() * 1e-6;
    if (this.hasTimer()) {
      if (elpasedTime > this.configs.time.perStep) {
        this.remainingOverage -= elpasedTime - this.configs.time.perStep;
      }
      if (this.remainingOverage < 0) {
        // this usually shouldn't happen as this will be caught out by the timer above, but if so, emit the timeotu event
        this.emit(Events.TIMEOUT);
      }
    }
    return action;
  }
}