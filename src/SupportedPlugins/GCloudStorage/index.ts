import { Storage as DStorage } from '../../Plugin/Storage';
import { Storage, Bucket, GetSignedUrlConfig } from '@google-cloud/storage';
import { DeepPartial } from '../../utils/DeepPartial';
import { Dimension, StorageType } from '../../Dimension';
import { Plugin } from '../../Plugin';
import path from 'path';
import fs, { copyFileSync } from 'fs';
import { Database } from '../../Plugin/Database';
import { Tournament } from '../../Tournament';
import LRUFileCache from '../../utils/LRUFileCache';
import { LOCAL_DIR } from '../../utils/System';
import { Logger } from '../../Logger';

export class GCloudStorage extends DStorage {
  public name = 'GCloudStorage';
  public type: Plugin.Type = Plugin.Type.STORAGE;
  public storage: Storage;
  public configs: GCloudStorage.Configs = {
    keyFilename: '',
    projectId: '',
    fileCacheMaxSize: 1024 * 1024 * 1024,
    loggingLevel: Logger.LEVEL.INFO,
    cacheDir: 'cache',
  };

  public log: Logger;

  public dimensionBucket: Bucket;

  private lruFileCache: LRUFileCache;

  constructor(configs: DeepPartial<GCloudStorage.Configs>) {
    super(configs);

    // default cache size of 1 GB
    this.lruFileCache = new LRUFileCache(
      this.configs.fileCacheMaxSize,
      path.join(LOCAL_DIR, this.configs.cacheDir)
    );

    this.log = new Logger(this.configs.loggingLevel, 'GCloud-Storage');
  }

  /**
   * Initializer. Initializes the storage object and creates necessary buckets
   */
  async initialize(dimension: Dimension): Promise<void> {
    const bucketName =
      dimension.name.toLowerCase().replace(/ /g, '_') +
      '_' +
      dimension.id.toLowerCase();
    this.storage = new Storage({
      keyFilename: this.configs.keyFilename,
      projectId: this.configs.projectId,
    });
    const exists = await this.storage.bucket(bucketName).exists();
    if (!exists[0]) {
      this.log.system(`creating bucket ${bucketName}`);
      await this.storage.createBucket(bucketName);
    }
    this.dimensionBucket = this.storage.bucket(bucketName);
  }

  async uploadTournamentFile(
    file: string,
    user: Database.User,
    tournament: Tournament
  ): Promise<string> {
    const dest = `users/${user.username}_${
      user.playerID
    }/tournaments/${tournament.getKeyName()}/bot.zip`;
    return this.dimensionBucket
      .upload(file, {
        destination: dest,
      })
      .then(() => {
        this.log.system(
          `uploaded tournament file for player ${user.playerID} to ${dest}`
        );
        return dest;
      });
  }

  async upload(file: string, destination?: string): Promise<string> {
    const dest = `${destination ? destination : path.basename(file)}`;
    return this.dimensionBucket
      .upload(file, {
        destination: dest,
      })
      .then(() => {
        this.log.system(`uploaded file from ${file} to ${dest}`);
        return dest;
      });
  }

  async download(
    key: string,
    destination: string,
    useCached: boolean
  ): Promise<string> {
    return new Promise((resolve) => {
      if (useCached) {
        const cachedPath = this.lruFileCache.get(key);
        // if there is a cached path, use it
        if (cachedPath) {
          copyFileSync(cachedPath, destination);
          resolve(destination);
          return;
        }
      }
      const file = this.dimensionBucket.file(key);
      const ws = file
        .createReadStream()
        .pipe(fs.createWriteStream(destination));
      ws.on('close', async () => {
        // store in cache
        const cachedPath = await this.lruFileCache.add(key, destination);
        this.log.system(
          `writing from bucket ${key} -> ${destination}; cached to ${cachedPath}`
        );
        resolve(destination);
      });
    });
  }

  /**
   * Returns a download URL to use to download an object
   * @param key - key referencing the object to download
   */
  async getDownloadURL(key: string): Promise<string> {
    const options: GetSignedUrlConfig = {
      version: 'v4',
      action: 'read',
      expires: new Date().getTime() + 15 * 60 * 1000,
    };
    return this.dimensionBucket
      .file(key)
      .getSignedUrl(options)
      .then((url) => {
        return url[0];
      });
  }

  public async manipulate(dimension: Dimension): Promise<void> {
    dimension.configs.backingDatabase = StorageType.GCLOUD;
    return;
  }
}

export namespace GCloudStorage {
  /**
   * Specific configurations for GCloud storage
   */
  export interface Configs extends DeepPartial<DStorage.Configs> {
    /**
     * Path to key file from a google account service key
     */
    keyFilename: string;

    /**
     * Project ID
     */
    projectId: string;

    /**
     * When caching files to prevent downloading the same data files over and over, this is the max size of files to
     * try and cache before throwing out the largest least used files.
     *
     * @default `1 GB = 1024 * 1024 * 1024`
     */
    fileCacheMaxSize: number;

    /**
     * Location for all cached files. Actual location is a subdirectry of the local directory used for storing files
     * related to dimensions
     * @default `cache`
     */
    cacheDir: string;

    /**
     * Logging level for storage service
     */
    loggingLevel: Logger.LEVEL;
  }
}
