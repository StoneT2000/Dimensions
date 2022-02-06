import * as DError from '../DimensionError';
import { EventEmitter } from 'events';
import { Process } from '../Process';
import { deepMerge } from '../utils/DeepMerge';
import { DeepPartial } from '../utils/DeepPartial';
import { CallTypes, Configs, Events, Status } from './types';
import fs from 'fs';
import { Logger } from '../Logger';
import { LocalProcess } from '../Process/local';
import { DockerProcess } from '../Process/docker';
import path from 'path';
import * as Timed from '../utils/Timed';

export class Agent extends EventEmitter {
  public p: Process;
  public id: string = null;
  public status: Status = Status.DONE;
  public configs: Configs = {
    agent: null,
    name: null,
    location: 'local',
  };

  public log: Logger = new Logger();

  private static globalID = 0;

  constructor(configs: DeepPartial<Configs> = {}) {
    super();
    this.configs = deepMerge(this.configs, configs);
    if (!this.configs.agent) {
      throw new TypeError('No agent executable provided');
    }
    if (!fs.existsSync(this.configs.agent)) {
      throw new DError.MissingFilesError(`no such file ${this.configs.agent}`);
    }
    // ensure we have proper settings
    // TODO: check windows
    fs.chmodSync(this.configs.agent, '755');

    // agent_<id> is on scope of whole process.
    // player_<player_index> is on scope of a single episode
    this.id = `agent_${Agent.globalID++}`;
  }

  /**
   * Initialize the agent process
   */
  async initialize(): Promise<void> {
    if (this.configs.location === 'local') {
      this.p = new LocalProcess(
        this.configs.agent,
        [],
        this.configs.processOptions
      );
    } else if (this.configs.location === 'docker') {
      this.p = new DockerProcess(
        this.configs.agent,
        [],
        path.dirname(this.configs.agent),
        this.configs.processOptions
      );
    }
    // setup timeout functionality
    if (this.p.timed._hasTimer()) {
      this.p.timed.on(Timed.Events.TIMEOUT, (timeout: number) => {
        // Super useful console.trace();
        this.log.error(
          `Agent timed out after ${timeout}ms, reason: ${this.p.timed.currentTimeoutReason}`
        );
        this.status = Status.ERROR;
        this.close();
      });
      this.p.timed.on(Timed.Events.ERROR, (reason: string, err: Error) => {
        this.log.error('Agent Errored Out:', reason);
        this.log.error('Details:', err);
        this.status = Status.ERROR;
        this.close();
      });
    }
    if (this._hasMemoryLimits()) {
      this.on(Events.OUTOFMEMORY, () => {
        this.log.error(
          `Out of memory after exceeding ${this.configs.processOptions.memory.limit} bytes`
        );
        this.status = Status.ERROR;
        this.close();
      });
    }
    await this.p.init();
    this.p.log.identifier = `[${this.id}]`;
    if (this.configs.name) {
      this.p.log.identifier = `[${this.configs.name} (${this.id})]`;
    }
    this.log.identifier = this.p.log.identifier;

    // perform handshake to verify agent is alive
    this.p.timed.currentTimeoutReason =
      'Could not send agent initialization information';
    await this.p.send(
      JSON.stringify({
        name: this.configs.name,
        id: this.id,
        type: CallTypes.INIT,
      })
    );
    this.p.timed.currentTimeoutReason =
      'Did not receive agent id back from agent during initialization';
    const d = await this.p.readstdout();
    const data = JSON.parse(d);
    if (data.id !== this.id)
      throw new Error(
        `Agent responded with wrong id of ${data.id} instead of ${this.id} during initialization`
      );
    if (data.name) {
      this.configs.name = data.name;
    }

    // agent is now ready and active!
    this.status = Status.ACTIVE;
  }

  /**
   *
   * @returns true when this agent object is ready to send actions and receive observations
   */
  async ready(): Promise<boolean> {
    return this.p !== undefined && this.status == Status.ACTIVE;
  }

  /**
   *
   * @returns true when this agent is active
   */
  active(): boolean {
    return this.status === Status.ACTIVE;
  }

  /**
   * Clean up the agent process
   */
  async close(): Promise<void> {
    if (this.active()) {
      await this.p.send(
        JSON.stringify({
          type: CallTypes.CLOSE,
        })
      );
      await this.p.close(); // TODO, configurable, give agent a certain amount of cooldown before force stopping it
      this.status = Status.DONE;
    }
  }

  _hasMemoryLimits(): boolean {
    // TODO implement
    return true;
  }

  /**
   * Retrieve an action from the agent
   *
   * @param data - typically the data provided by env.step() functions
   * @returns Record<string, any> that details the retrieved action from the agent or null if there is an error (agent takes no action)
   * Potential errors are agent timing out, or agent sending invalid JSON formatted action object
   */
  async action(data: Record<string, any>): Promise<Record<string, any> | null> {
    try {
      this.p.timed.currentTimeoutReason =
        'Agent did not receive request for action';
      await this.p.send(
        JSON.stringify({
          ...data,
          type: CallTypes.ACTION,
        })
      );
      this.p.timed.currentTimeoutReason =
        'Agent did not respond with an action in time';
      const action: Record<string, any> = JSON.parse(await this.p.readstdout());
      if (action.action === undefined) {
        throw new Error(
          `Action is malformed, expected action to be a key in agent JSON output but was not found`
        );
      }
      return action;
    } catch {
      return { action: null };
    }
  }

  async resume(): Promise<void> {
    return this.p.resume();
  }
  async pause(): Promise<void> {
    return this.p.pause();
  }
}
