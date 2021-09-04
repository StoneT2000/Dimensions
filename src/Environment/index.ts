import { AgentActions, CallTypes, RenderModes } from "./types";
import path from 'path';
import { Process } from "../Process";
export class Environment {

  public envProcess: Process;
  public id: string = null;

  private static globalID = 0;
  /**
   * Create a new environment. Should call await setup() immediately
   * @param environment - path to environment file to be used
   * @param envConfigs - configurations that are sent to the environment
   */
  constructor(public environment: string, public envConfigs: string = null) {
    // TODO: initialize an environment process.
    if (path.extname(environment) === ".py") {
      this.envProcess = new Process("python", [environment]);
    }

    this.id = `env_${Environment.globalID++}`;
  }
  async setup(): Promise<any> {
    await this.envProcess.send(JSON.stringify({
      envConfigs: this.envConfigs,
      type: CallTypes.INIT
    }))
    return JSON.parse(await this.envProcess.readstdout());
  }
  /**
   * 
   * @param actions 
   */
  async step(agentActions: AgentActions): Promise<Record<string, any>> {
    await this.envProcess.send(JSON.stringify({
      agentActions,
      type: CallTypes.STEP
    }));
    return JSON.parse(await this.envProcess.readstdout());
  }
  async reset(state: string = null): Promise<Record<string, any>> {
    await this.envProcess.send(JSON.stringify({
      state,
      type: CallTypes.RESET
    }));
    return JSON.parse(await this.envProcess.readstdout());
  }

  /**
   * Seed the environment. Return a string representing the environment's random number generator states
   * @param seed - the seed value to use
   */
  async seed(seed: number): Promise<Record<string, any>> {
    await this.envProcess.send(JSON.stringify({
      seed,
      type: CallTypes.SEED
    }));
    return JSON.parse(await this.envProcess.readstdout());
  }

  /**
   * Request render information from the environment
   * 
   * Web visualizers can call this function each time a step is taken to render as the environment progresses, although this will be slower.
   * Otherwise recommended to take all the render states stored in the environment and render at once
   */
  async render(
    mode: RenderModes 
  ): Promise<Record<string, any>> {
    await this.envProcess.send(JSON.stringify({
      mode,
      type: CallTypes.RENDER
    }));
    return JSON.parse(await this.envProcess.readstdout());
  }
  /**
   * Perform any clean up operations and close the environment
   */
  async close(): Promise<void> {
    await this.envProcess.send(JSON.stringify({
      type: CallTypes.CLOSE
    }));
    // await this.envProcess.close(); // TODO add a timeout to the closing. If env does not close in some time limit, send interrupt signal
  }
}