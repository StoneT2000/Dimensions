import { AgentsActions, CallTypes, RenderModes } from "./types";
import path from 'path';
import { Process } from "../Process";
export class Environment {

  public envProcess: Process;

  /**
   * Create a new environment
   * @param environment - path to environment file to be used
   * @param envConfigs - configurations that are sent to the environment
   */
  constructor(environment: string, envConfigs = '{}') {
    // TODO: initialize an environment process.
    if (path.extname(environment) === ".py") {
      this.envProcess = new Process("python", [environment]);
      this.envProcess.send(JSON.stringify({
        envConfigs,
        type: CallTypes.INIT
      }))
    }
  }
  /**
   * 
   * @param actions 
   */
  async step(actions: AgentsActions): Promise<string> {
    this.envProcess.send(JSON.stringify({
      actions,
      type: CallTypes.STEP
    }));
    return this.envProcess.readstdout();
  }
  reset(state?: string): Promise<string> {
    this.envProcess.send(JSON.stringify({
      state,
      type: CallTypes.STEP
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
  close(): void {
    this.envProcess.send(JSON.stringify({
      type: CallTypes.CLOSE
    }));
  }
}