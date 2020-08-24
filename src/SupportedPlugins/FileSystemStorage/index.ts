import { Storage } from '../../Plugin/Storage';
import { Dimension, StorageType } from '../../Dimension';
import { Plugin } from '../../Plugin';
import path from 'path';
import { Database } from '../../Plugin/Database';
import { Tournament } from '../../Tournament';
import { writeFileToDestination, LOCAL_DIR } from '../../utils/System';
import { NotImplemented } from '../../Station/error';

export class FileSystemStorage extends Storage {
  public name = 'FS-Storage';
  public type: Plugin.Type = Plugin.Type.STORAGE;
  public bucketPath: string;

  constructor() {
    super();
  }

  /**
   * Initializer. Initializes the storage object and creates necessary buckets
   */
  async initialize(dimension: Dimension): Promise<void> {
    const bucketPath = path.join(
      LOCAL_DIR,
      dimension.name.toLowerCase().replace(/ /g, '_') +
        '_' +
        dimension.id.toLowerCase()
    );
    this.bucketPath = bucketPath;
  }

  async writeFileToBucket(file: string, dest: string): Promise<void> {
    await writeFileToDestination(file, path.join(this.bucketPath, dest));
  }
  async writeFileFromBucket(key: string, dest: string): Promise<void> {
    await writeFileToDestination(path.join(this.bucketPath, key), dest);
  }

  async uploadTournamentFile(
    file: string,
    user: Database.User,
    tournament: Tournament
  ): Promise<string> {
    const dest = `users/${user.username}_${
      user.playerID
    }/tournaments/${tournament.getKeyName()}/bot.zip`;
    await this.writeFileToBucket(file, dest);
    return dest;
  }

  async upload(file: string, destination?: string): Promise<string> {
    const dest = `${destination ? destination : path.basename(file)}`;
    await this.writeFileToBucket(file, dest);
    return dest;
  }

  async download(key: string, destination: string): Promise<void> {
    return this.writeFileFromBucket(key, destination);
  }

  /**
   * Returns a download URL to use to download an object
   * @param key - key referencing the object to download
   */
  async getDownloadURL(key: string): Promise<string> {
    key;
    throw new NotImplemented('download by url is not implemented yet');
  }

  public async manipulate(dimension: Dimension): Promise<void> {
    dimension.configs.backingDatabase = StorageType.FS;
    return;
  }
}
