import { AgentActions, CallTypes, RenderModes } from "./types";
import path from 'path';
import { Process } from "../Process";
export class Environment {

  public envProcess: Process;

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
   * 
   */
  render(
    mode: RenderModes 
  ): any {
    mode;
    return;
  }
  /**
   * Perform any clean up operations
   */
  async close(): Promise<void> {
    await this.envProcess.send(JSON.stringify({
      type: CallTypes.CLOSE
    }));
  }
}