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
  async setup(): Promise<string> {
    await this.envProcess.send(JSON.stringify({
      envConfigs: this.envConfigs,
      type: CallTypes.INIT
    }))
    return this.envProcess.readstdout();
  }
  /**
   * 
   * @param actions 
   */
  async step(agentActions: AgentActions): Promise<string> {
    await this.envProcess.send(JSON.stringify({
      agentActions,
      type: CallTypes.STEP
    }));
    return this.envProcess.readstdout();
  }
  async reset(state: string = null): Promise<string> {
    await this.envProcess.send(JSON.stringify({
      state,
      type: CallTypes.RESET
    }));
    return this.envProcess.readstdout();
  }

  /**
   * Seed the environment. Return a string representing the environment's random number generator states
   * @param seed - the seed value to use
   */
  async seed(seed: number): Promise<string> {
    await this.envProcess.send(JSON.stringify({
      seed,
      type: CallTypes.SEED
    }));
    return this.envProcess.readstdout();
  }

  /**
   * Request render information from the environment
   * 
   * Web visualizers can call this function each time a step is taken to render as the environment progresses, although this will be slower.
   * Otherwise recommended to take all the render states stored in the environment and render at once
   */
  async render(
    mode: RenderModes 
  ): Promise<string> {
    await this.envProcess.send(JSON.stringify({
      mode,
      type: CallTypes.RENDER
    }));
    return this.envProcess.readstdout();
  }
  /**
   * Perform any clean up operations and close the environment
   */
  async close(): Promise<void> {
    await this.envProcess.send(JSON.stringify({
      type: CallTypes.CLOSE
    }));
    await this.envProcess.close();
  }
}