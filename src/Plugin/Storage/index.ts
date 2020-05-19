import { Plugin } from "..";
import { DeepPartial } from "../../utils/DeepPartial";
import { deepMerge } from "../../utils/DeepMerge";
import { Dimension } from "../../Dimension";
import { nanoid } from "../..";
import { Database } from "../Database";
import { Tournament } from "../../Tournament";

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
   * Upload a file (should be a zip) for a tournament. Returns a identifying key to allow for future retrieval
   * @param file - path to file to upload
   * @param userID - id of user file belongs to
   * @param tournamentID - id of the tournament this file is to be used for
   */
  abstract async uploadTournamentFile(file: string, user: Database.User, tournament: Tournament): Promise<string>

  /**
   * Upload a file
   * @param file - path to file to upload
   * @param userID - id of user file belongs to
   * @param destinationName - destination name
   */
  abstract async upload(file: string, userID: nanoid, destinationName: string): Promise<string>

  /**
   * Download a file to a destination location
   * @param key - the key referencing the object to download
   * @param destination - destination path to download to locally
   */
  abstract async download(key: string, destination: string): Promise<any>

  /**
   * Get download url (signed url) for a objet with that key
   * @param key - the key referencing the object to download
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