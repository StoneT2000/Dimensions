import { Plugin } from '..';
import { Dimension } from '../../Dimension';
import { Database } from '../Database';
import { Tournament } from '../../Tournament';

export abstract class Storage extends Plugin {
  /** Default configs */
  public configs: Storage.Configs = {};
  /**
   * Performs any intialization tasks
   * Resolves when done
   */
  abstract async initialize(dimension: Dimension): Promise<any>;

  /**
   * Upload a file (should be a zip) for a tournament. Returns a identifying key to allow for future retrieval
   * @param file - path to file to upload
   * @param userID - id of user file belongs to
   * @param tournamentID - id of the tournament this file is to be used for
   */
  abstract async uploadTournamentFile(
    file: string,
    user: Database.User,
    tournament: Tournament
  ): Promise<string>;

  /**
   * Upload a file. Resolves with a key to allow for future retrieval
   * @param file - path tto file to upload
   * @param destinationName - destination name
   */
  abstract async upload(file: string, destinationName: string): Promise<string>;

  /**
   * Download a file to a destination location. Resolves with path to file.
   * If useCached is true and storage plugin does not need to redownload, destination is ignored
   *
   * @param key - the key referencing the object to download
   * @param destination - destination path to download to locally
   * @param useCached - if true, storage plugin should avoid downloading file at key if possible. otherwise always
   * redownload
   */
  abstract async download(
    key: string,
    destination: string,
    useCached: boolean
  ): Promise<string>;

  /**
   * Get download url (signed url) for a objet with that key
   * @param key - the key referencing the object to download
   */
  abstract async getDownloadURL(key: string): Promise<string>;
}

export namespace Storage {
  /**
   * Storage configs interface
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface Configs {}
}
