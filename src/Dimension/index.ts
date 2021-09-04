import * as DError from "../DimensionError";
import { deepMerge } from "../utils/DeepMerge";
import { DeepPartial } from "../utils/DeepPartial";
import { Configs } from "./types";
import { Configs as AgentConfigs } from "../Agent/types";
import fs from 'fs';
import { Environment } from "../Environment";
import { Agent } from "../Agent";
/**
 * A Dimension takes a user defined environment and builds a factory object that can create new environments
 * 
 * The new environments open up portals to allow other agents to connect and interact with the environment at high speeds
 * 
 * This class handles creating environment instances, agent instances, and linking them.
 * 
 * You can have multiple agents interact with one or multiple environment instances, a single agent interact with a single or multiple instances etc.
 */
export class Dimension {
  public configs: Configs = {
    station: false,
    name: 'default_dimension',
    environment: null,
  }
  
  public agents: Map<string, Agent> = new Map();

  public id: string = null;

  private static globalID = 0;

  constructor(configs: DeepPartial<Configs> = {}) {
    this.configs = deepMerge(this.configs, configs);
    if (!this.configs.environment) {
      throw new TypeError("No environment specification or executable provided")
    }
    if (!fs.existsSync(this.configs.environment)) {
      throw new DError.MissingFilesError(`no such file ${this.configs.environment}`);
    }

    this.id = `dimension_${Dimension.globalID++}`;

    // set up cleanup functions
    process.on('exit', async () => {
      try {
        await this.cleanup();
      } catch (err) {
        console.error(err);
      }
      process.exit();
    });

    process.on('SIGINT', async () => {
      try {
        await this.cleanup();
      } catch (err) {
        console.error(err);
      }
      process.exit();
    });
  }
  addAgent(configs: DeepPartial<AgentConfigs> = {}): Agent {
    const agent = new Agent(configs);
    this.agents.set(agent.id, agent);
    return agent;
  }
  /**
   * Creates a new environment, which runs the given environment on its own process
   */
  makeEnv(envConfigs?: string): Environment {
    const env = new Environment(this.configs.environment, envConfigs);
    return env;
  }

  /**
   * Cleanup the Dimension to gracefully quit and avoid leaks
   */
  async cleanup(): Promise<void> {
    const closePromises: Promise<void>[] = [];
    this.agents.forEach((agent) => {
      closePromises.push(agent.close());
    });
    await Promise.all(closePromises);
  }
}