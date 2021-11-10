import { AgentActions, CallTypes, RenderModes } from './types';
import path from 'path';
import { Process } from '../Process';
import { DError } from '../DimensionError/wrapper';
import { LocalProcess } from '../Process/local';

/**
 * A wrapper around a given environment executable or python gym to allow cross-language interaction
 */
export class Environment {
  public envProcess: Process;
  public id: string = null;
  public steps = 0;

  public metaData: Record<string, any> = null;

  /**
   * Maps agent ID to player ID in the environment. Mostly used for MultiAgent scenarios
   */
  public agentIDToPlayerID: Map<string, string> = new Map();

  private static globalID = 0;
  /**
   * Create a new environment. Should call await setup() immediately
   * @param environment - path to environment file to be used
   * @param envConfigs - configurations that are sent to the environment
   */
  constructor(
    public environment: string,
    public envConfigs: Record<string, any> = {},
    public name?: string
  ) {
    this.id = `env_${Environment.globalID++}`;
  }

  /**
   * Initialize the environment process and read back metadata from the environment.
   * @returns 
   */
  async setup(): Promise<Record<string, any>> {
    // start environment process.
    if (path.extname(this.environment) === '.py') {
      this.envProcess = new LocalProcess('python', [this.environment]);
    } else {
      throw new DError.NotSupportedError('Envionment type not supported yet');
    }
    await this.envProcess.init();
    this.envProcess.log.identifier = `[${this.id}]`;
    if (this.name) {
      this.envProcess.log.identifier = `[${this.name}]`;
    }

    // send initialization information to create a environment
    await this.envProcess.send(
      JSON.stringify({
        envConfigs: this.envConfigs,
        type: CallTypes.INIT,
      })
    );
    // read back metadata
    const metaData = JSON.parse(await this.envProcess.readstdout());
    this.metaData = metaData;
    if (this.name == undefined && this.metaData.name !== undefined) this.name = this.metaData.name;
    if (this.name) {
      this.envProcess.log.identifier = `[${this.name}]`;
    }
    return metaData;
  }

  /**
   * Step through the environment with the given action(s). `actions` is directly sent to the env process
   * @param actions - can be anything
   * @returns the return value of the env process `step` function, usually 
   * ```
   * {
   *    obs: array,
   *    reward: number,
   *    done: boolean,
   *    info: object
   * }
   * ```
   * 
   * Or in the case of Multi Agent environments like Pettingzoo envs, it is the same as above but keyed by player ids
   */
  async step(actions: AgentActions): Promise<Record<string, any>> {
    this.steps += 1;
    await this.envProcess.send(
      JSON.stringify({
        actions,
        type: CallTypes.STEP,
      })
    );
    return JSON.parse(await this.envProcess.readstdout());
  }
  async reset(state: Record<string, any> = null): Promise<Record<string, any>> {
    this.steps = 0;
    // TODO: encode state into observations and let env optionally return that when stepping
    await this.envProcess.send(
      JSON.stringify({
        state,
        type: CallTypes.RESET,
      })
    );
    return JSON.parse(await this.envProcess.readstdout());
  }

  /**
   * Seed the environment. Return a string representing the environment's random number generator states
   * @param seed - the seed value to use
   */
  async seed(seed: number): Promise<Record<string, any>> {
    await this.envProcess.send(
      JSON.stringify({
        seed,
        type: CallTypes.SEED,
      })
    );
    return JSON.parse(await this.envProcess.readstdout());
  }

  /**
   * Request render information from the environment
   *
   * Web visualizers can call this function each time a step is taken to render as the environment progresses, although this will be slower.
   * Otherwise recommended to take all the render states stored in the environment and render at once
   */
  async render(mode: RenderModes): Promise<Record<string, any>> {
    // TODO finish
    await this.envProcess.send(
      JSON.stringify({
        mode,
        type: CallTypes.RENDER,
      })
    );
    return JSON.parse(await this.envProcess.readstdout());
  }

  /**
   * Registers an agent into the running environment. Useful function for typical environments and for environments where there are variable agents / agents
   * can be registered later.
   * @param ids - ids of agents to register
   */
  async registerAgents(ids: string[]): Promise<void> {
    await this.envProcess.send(
      JSON.stringify({
        ids,
        type: CallTypes.REGISTER_AGENTS,
      })
    );
    const data = JSON.parse(await this.envProcess.readstdout());
    ids.forEach((id, i) => {
      this.agentIDToPlayerID.set(id, data.ids[i]);
    });
    return;
  }

  /**
   * Perform any clean up operations and close the environment
   */
  async close(): Promise<void> {
    await this.envProcess.send(
      JSON.stringify({
        type: CallTypes.CLOSE,
      })
    );
    // await this.envProcess.close(); // TODO add a timeout to the closing. If env does not close in some time limit, send interrupt signal
  }
}
