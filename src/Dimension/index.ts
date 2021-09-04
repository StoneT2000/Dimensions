import * as DError from "../DimensionError";
import { deepMerge } from "../utils/DeepMerge";
import { DeepPartial } from "../utils/DeepPartial";
import { Configs } from "./types";
import fs from 'fs';
import os from 'os';
import { Environment } from "../Environment";
/**
 * A Dimension takes a user defined environment and builds a factory object that can create new environments
 * 
 * The new environments open up portals to allow other agents to connect and interact with the environment at high speeds
 * 
 * This class handles creating environment instances, agent instances, and linking them.
 */
export class Dimension {
  public configs: Configs = {
    station: false,
    name: 'default_dimension',
    environment: null,
  }
  constructor(configs: DeepPartial<Configs> = {}) {
    this.configs = deepMerge(this.configs, configs);
    if (!configs.environment) {
      throw new TypeError("No environment specification or executable provided")
    }
    if (!fs.existsSync(this.configs.environment)) {
      throw new DError.MissingFilesError(`no such file ${this.configs.environment}`);
    }
  }
  /**
   * Creates a new environment, which runs the given environment on its own process
   */
  make(envConfigs?: string): Environment {
    return new Environment(this.configs.environment, envConfigs);
  }
}