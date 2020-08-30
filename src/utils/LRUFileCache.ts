import fs, { copyFileSync, mkdirSync } from 'fs';
import constants from 'constants';
import { removeDirectory } from './System';
import path from 'path';
/**
 * A variant of the LRU cache where this cache stores mappings from keys to file paths. This throws out least recently
 * used items when adding a new file path to cache. Thrown out items are removed from cache and the file it pointed to
 * is deleted
 */
export default class LRUFileCache {
  public size = 0;
  public max: number;
  private cache: Map<string, LRUFileCacheNode> = new Map();
  public queueHead: LRUFileCacheNode = null;
  public queueTail: LRUFileCacheNode = null;
  public cachePath: string;
  constructor(max: number, cachePath: string) {
    this.max = max;
    this.cachePath = cachePath;
  }
  /**
   * Adds key to file path pair to cache and copies file to new location. Does not delete the given file at filepath
   *
   * Automatically throws out least recently used items if not enough space left to
   * fit new file
   *
   * Resolves with path to cached file location
   *
   * @param key - the key pointing to the given file path
   * @param filepath - the file path representing the file to cache
   */
  async add(key: string, filepath: string): Promise<string> {
    let newfilesize = 0;
    key = key.replace(/\//g, '_');
    try {
      const meta = fs.statSync(filepath);
      newfilesize = meta.size;
    } catch (err) {
      if (err.errno === -constants.ENOENT) {
        throw new Error('file does not exist');
      }
    }
    if (newfilesize > this.max) {
      throw new Error(
        `file is at ${filepath} too large, ${newfilesize} > ${this.max} allocated bytes`
      );
    }
    let trimmedSize = this.size;
    const removeFilePromises: Array<Promise<void>> = [];
    // console.log({ newfilesize, trimmedSize }, this.max);
    while (newfilesize + trimmedSize > this.max) {
      // find files until under max
      const newtail = this.queueTail.prev;
      trimmedSize -= this.queueTail.filesize;
      removeFilePromises.push(
        removeDirectory(
          path.dirname(
            this.getCachedFilePath(this.queueTail.filepath, this.queueTail.key)
          )
        )
      );
      this.cache.delete(this.queueTail.key);
      if (newtail) {
        newtail.next = null;
        this.queueTail = newtail;
      }
    }
    await Promise.all(removeFilePromises);

    const node = new LRUFileCacheNode(filepath, newfilesize, key);

    if (this.cache.size === 0) {
      this.queueHead = node;
      this.queueTail = node;
    } else if (this.cache.size === 1) {
      this.queueTail = this.queueHead;
      this.queueHead = node;
      this.queueHead.next = this.queueTail;
      this.queueTail.prev = this.queueHead;
    } else {
      // integrate new node into queue.
      node.next = this.queueHead;
      this.queueHead.prev = node;
      this.queueHead = node;
    }
    this.cache.set(key, node);

    // copy file

    const cachedPath = this.getCachedFilePath(filepath, key);
    mkdirSync(path.dirname(cachedPath), {
      recursive: true,
    });
    copyFileSync(filepath, cachedPath);
    this.size += newfilesize;
    return cachedPath;
  }

  private getCachedFilePath(filepath: string, key: string) {
    key = key.replace(/\//g, '_');
    return path.join(this.cachePath, key, path.basename(filepath));
  }

  has(key: string): boolean {
    key = key.replace(/\//g, '_');
    return this.cache.has(key);
  }

  /**
   * Gets the cached file path associated with the key. Returns undefined if file mapped from key is not cached
   * @param key
   */
  get(key: string): string {
    key = key.replace(/\//g, '_');
    if (this.has(key)) {
      // move node to front
      const node = this.cache.get(key);
      if (node.prev) {
        node.prev.next = node.next;
      }
      if (node.next) {
        node.next.prev = node.prev;
      }
      if (node === this.queueTail) {
        this.queueTail = node.prev;
      }
      node.next = this.queueHead;
      this.queueHead.prev = node;
      node.prev = null;
      this.queueHead = node;

      // return cached path
      return this.getCachedFilePath(this.cache.get(key).filepath, key);
    }
    return undefined;
  }
}

class LRUFileCacheNode {
  next: LRUFileCacheNode = null;
  prev: LRUFileCacheNode = null;
  constructor(
    public filepath: string,
    public filesize: number,
    public key: string
  ) {}
}
