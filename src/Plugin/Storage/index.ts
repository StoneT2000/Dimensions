import { Plugin } from "..";
import { DeepPartial } from "../../utils/DeepPartial";
import { deepMerge } from "../../utils/DeepMerge";
import { Dimension } from "../../Dimension";

export abstract class Storage extends Plugin {
  
  /** Default configs */
  public configs: Storage.Configs = {
  }
  constructor(configs: DeepPartial<Storage.Configs> = {}) {
    super();
    deepMerge(this.configs, configs);
  }

  /**
   * Performs any intialization tasks
   * Resolves when done
   */
  abstract async initialize(dimension: Dimension): Promise<any>

  /**
   * Upload a file (should be a zip). Returns a identifying key to allow for future retrieval
   */
  abstract async upload(file: string): Promise<string>

  /**
   * Download a file to a destination location
   */
  abstract async download(key: string, destination: string): Promise<any>

  /**
   * Get download url (signed url) for a objet with that key
   */
  abstract async getDownloadURL(key: string): Promise<string>
}

export module Storage {

  /**
   * Storage configs interface
   */
  export interface Configs {

  }
}