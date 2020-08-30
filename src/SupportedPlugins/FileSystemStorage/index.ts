import { Storage } from '../../Plugin/Storage';
import { Dimension, StorageType } from '../../Dimension';
import { Plugin } from '../../Plugin';
import path from 'path';
import { Database } from '../../Plugin/Database';
import { Tournament } from '../../Tournament';
import { writeFileToDestination, LOCAL_DIR } from '../../utils/System';
import LRUFileCache from '../../utils/LRUFileCache';
import { Logger } from '../../Logger';
import { deepMerge } from '../../utils/DeepMerge';
import { deepCopy } from '../../utils/DeepCopy';
import { DeepPartial } from '../../utils/DeepPartial';

export class FileSystemStorage extends Storage {
  public name = 'FS-Storage';
  public type: Plugin.Type = Plugin.Type.STORAGE;
  public bucketPath: string;
  private lruFileCache: LRUFileCache;
  public log: Logger;
  public _useCacheCount = 0;
  public configs: FileSystemStorage.Configs = {
    maxCacheSize: 1024 * 1024 * 50,
    cacheDir: 'cache',
    loggingLevel: Logger.LEVEL.INFO,
  };
  constructor(configs?: DeepPartial<FileSystemStorage.Configs>) {
    super();
    this.configs = deepMerge(this.configs, deepCopy(configs));
    this.lruFileCache = new LRUFileCache(
      this.configs.maxCacheSize,
      path.join(LOCAL_DIR, this.configs.cacheDir)
    );
    this.log = new Logger(this.configs.loggingLevel, 'FS-Storage');
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
    this.log.system(`writing to bucket ${file} -> ${dest}`);
    await writeFileToDestination(file, path.join(this.bucketPath, dest));
  }
  async writeFileFromBucket(key: string, dest: string): Promise<void> {
    this.log.system(`writing from bucket ${key} -> ${dest}`);
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

  async download(
    key: string,
    destination: string,
    useCached: boolean
  ): Promise<string> {
    if (useCached) {
      const cachedPath = this.lruFileCache.get(key);
      // if there is a cached path, use it
      if (cachedPath) {
        this._useCacheCount++;
        return cachedPath;
      }
    }
    await this.writeFileFromBucket(key, destination);
    // store in cache
    const cachedPath = this.lruFileCache.add(key, destination);
    return cachedPath;
  }

  /**
   * Returns a download URL to use to download an object
   * @param key - key referencing the object to download
   */
  async getDownloadURL(key: string): Promise<string> {
    return path.join(this.bucketPath, key);
  }

  public async manipulate(dimension: Dimension): Promise<void> {
    dimension.configs.backingStorage = StorageType.FS;
    return;
  }
}

export namespace FileSystemStorage {
  export interface Configs {
    maxCacheSize: number;
    cacheDir: string;
    loggingLevel: Logger.LEVEL;
  }
}
