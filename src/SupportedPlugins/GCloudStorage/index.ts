import { Storage as DStorage } from "../../Plugin/Storage";
import { Storage, Bucket, GetSignedUrlConfig } from '@google-cloud/storage';
import { DeepPartial } from "../../utils/DeepPartial";
import { Dimension, StorageType } from "../../Dimension";
import { Plugin } from "../../Plugin";
import { nanoid } from "../..";
import path from 'path';
import fs from "fs";
import { Database } from "../../Plugin/Database";
import { Tournament } from "../../Tournament";

export class GCloudStorage extends DStorage {
  public name: string = 'GCloudStorage'
  public type: Plugin.Type = Plugin.Type.STORAGE
  public storage: Storage;
  public configs: GCloudStorage.Configs;
  
  public dimensionBucket: Bucket;

  constructor(configs: GCloudStorage.Configs) {
    super(configs);
  }

  /**
   * Initializer. Initializes the storage object and creates necessary buckets
   */
  async initialize(dimension: Dimension) {
    let bucketName = dimension.name.toLowerCase() + '_' + dimension.id.toLowerCase();
    this.storage = new Storage({keyFilename: this.configs.keyFilename});
    let exists = await this.storage.bucket(bucketName).exists();
    if (!exists) {
       await this.storage.createBucket(bucketName);
    }
    this.dimensionBucket = this.storage.bucket(bucketName);
    await this.dimensionBucket.upload("./tests/run.3.ts");
  }

  async uploadTournamentFile(file: string, user: Database.User, tournament: Tournament) {
    let dest = 
      `users/${user.username}_${user.playerID}/tournaments/${tournament.getKeyName()}/bot.zip`
    return this.dimensionBucket.upload(file, {
      destination: dest
    }).then(() => {
      return dest;
    });
  }

  async upload(file: string, userID: nanoid, destination?: string) {
    let dest = `users/${userID}/${destination ? destination : path.basename(file)}`;
    return this.dimensionBucket.upload(file, {
      destination: dest
    }).then(() => {
      return dest;
    })
  }

  async download(key: string, destination: string) {
    return new Promise((resolve, reject) => {
      let file = this.dimensionBucket.file(key);
      let ws = file.createReadStream().pipe(fs.createWriteStream(destination));
      ws.on('close', () => {
        resolve();
      });
    })
  }

  /**
   * Returns a download URL to use to download an object
   * @param key - key referencing the object to download
   */
  async getDownloadURL(key: string) {
    let options: GetSignedUrlConfig = {
      version: 'v4',
      action: 'read',
      expires: (new Date()).getTime() + 15 * 60 * 1000
    }
    return this.dimensionBucket.file(key).getSignedUrl(options).then((url) => {
      return url[0];
    });
  }

  public async manipulate(dimension: Dimension) {
    dimension.configs.backingDatabase = StorageType.GCLOUD;
    return;
  }
}

export module GCloudStorage {
  /**
   * Specific configurations for GCloud storage
   */
  export interface Configs extends DeepPartial<DStorage.Configs> {
    /**
     * Path to key file from a google account service key
     */
    keyFilename: string
  }
}