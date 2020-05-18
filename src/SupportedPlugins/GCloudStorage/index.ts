import { Storage as DStorage } from "../../Plugin/Storage";
import { Storage, Bucket, GetSignedUrlConfig } from '@google-cloud/storage';
import { DeepPartial } from "../../utils/DeepPartial";
import { Dimension, DatabaseType, StorageType } from "../../Dimension";
import { Plugin } from "../../Plugin";

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
       await this.createBucket(bucketName);
    }
    this.dimensionBucket = this.storage.bucket(bucketName);
    await this.dimensionBucket.upload("./tests/run.3.ts");
  }

  async createBucket(bucketName: string) {
    // Creates the new bucket
    await this.storage.createBucket(bucketName);
  }
  
  async upload(file: string) {
    let key = '';
    return key;
  }

  async download(key: string, destination: string) {

    return;
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