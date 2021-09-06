import { AgentActions, CallTypes, RenderModes } from "./types";
import path from 'path';
import { Process } from "../Process";
import { Agent } from "../Agent";

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
  /**
   * Maps agent ID to Agent. Mostly used for MultiAgent scenarios. Unused if manually stepping through environment
   */
  public agents: Map<string, Agent> = new Map();

  private static globalID = 0;
  /**
   * Create a new environment. Should call await setup() immediately
   * @param environment - path to environment file to be used
   * @param envConfigs - configurations that are sent to the environment
   */
  constructor(public environment: string, public envConfigs: Record<string, any> = {}) {
    // TODO: initialize an environment process.
    if (path.extname(environment) === ".py") {
      this.envProcess = new Process("python", [environment]);
    }

    this.id = `env_${Environment.globalID++}`;
  }
  async setup(): Promise<Record<string, any>> {
    await this.envProcess.send(JSON.stringify({
      envConfigs: this.envConfigs,
      type: CallTypes.INIT
    }));
    // read back metadata
    const metaData = JSON.parse(await this.envProcess.readstdout());
    this.metaData = metaData;
    return metaData;
  }
  /**
   * 
   * @param actions 
   */
  async step(actions: AgentActions): Promise<Record<string, any>> {
    this.steps += 1;
    await this.envProcess.send(JSON.stringify({
      actions,
      type: CallTypes.STEP
    }));
    return JSON.parse(await this.envProcess.readstdout());
  }
  async reset(state: Record<string, any> = null): Promise<Record<string, any>> {
    this.steps = 0;
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
    // TODO finish
    await this.envProcess.send(JSON.stringify({
      mode,
      type: CallTypes.RENDER
    }));
    return JSON.parse(await this.envProcess.readstdout());
  }

  async addAgent(agent: Agent): Promise<Record<string, any>> {
    this.agents.set(agent.id, agent);
    // this.agentIDToPlayerID.set(agent.id, );
    // TODO send new agent info to game
    return {};
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