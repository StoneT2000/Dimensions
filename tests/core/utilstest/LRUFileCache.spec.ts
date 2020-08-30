import chai from 'chai';
import path from 'path';
import fs from 'fs';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from 'sinon-chai';
import 'mocha';
import LRUFileCache from '../../../src/utils/LRUFileCache';
import { LOCAL_DIR } from '../../../src/utils/System';
const expect = chai.expect;
chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset);

describe('Testing LRU File Caching system', () => {
  const files = {
    '2kb': './tests/files/cachetest/2kb',
    '4kb': './tests/files/cachetest/4kb',
    '8kb': './tests/files/cachetest/8kb',
  };
  it('should cache files', async () => {
    const cache = new LRUFileCache(
      1024 * 1024,
      path.join(LOCAL_DIR, 'cache_test_1')
    );
    await cache.add('key1', files['2kb']);
    await cache.add('key2', files['2kb']);
    await cache.add('key3', files['4kb']);
    await cache.add('key4', files['4kb']);
    expect(
      fs.existsSync(path.join(LOCAL_DIR, 'cache_test_1', 'key1', '2kb'))
    ).to.equal(true);
    expect(
      fs.existsSync(path.join(LOCAL_DIR, 'cache_test_1', 'key2', '2kb'))
    ).to.equal(true);
    expect(
      fs.existsSync(path.join(LOCAL_DIR, 'cache_test_1', 'key3', '4kb'))
    ).to.equal(true);
    expect(
      fs.existsSync(path.join(LOCAL_DIR, 'cache_test_1', 'key4', '4kb'))
    ).to.equal(true);
  });

  it('should throw out least used file', async () => {
    const cache = new LRUFileCache(
      1024 * 8,
      path.join(LOCAL_DIR, 'cache_test_2')
    );
    await cache.add('key1', files['2kb']);

    await cache.add('key2', files['2kb']);
    await cache.add('key3', files['4kb']);
    cache.get('key1');
    cache.get('key2');
    await cache.add('key4', files['4kb']);

    expect(
      fs.existsSync(path.join(LOCAL_DIR, 'cache_test_2', 'key1', '2kb'))
    ).to.equal(true);
    expect(
      fs.existsSync(path.join(LOCAL_DIR, 'cache_test_2', 'key2', '2kb'))
    ).to.equal(true);
    expect(
      fs.existsSync(path.join(LOCAL_DIR, 'cache_test_2', 'key3', '4kb'))
    ).to.equal(false);
    expect(
      fs.existsSync(path.join(LOCAL_DIR, 'cache_test_2', 'key4', '4kb'))
    ).to.equal(true);
  });

  it('should throw out several least used files to make space for large file', async () => {
    const cache = new LRUFileCache(
      1024 * 10,
      path.join(LOCAL_DIR, 'cache_test_3')
    );
    await cache.add('key1', files['2kb']);

    await cache.add('key2', files['2kb']);
    await cache.add('key3', files['2kb']);
    cache.get('key1');
    cache.get('key2');
    await cache.add('key4', files['8kb']);

    expect(
      fs.existsSync(path.join(LOCAL_DIR, 'cache_test_3', 'key1', '2kb'))
    ).to.equal(false);
    expect(
      fs.existsSync(path.join(LOCAL_DIR, 'cache_test_3', 'key2', '2kb'))
    ).to.equal(true);
    expect(
      fs.existsSync(path.join(LOCAL_DIR, 'cache_test_3', 'key3', '2kb'))
    ).to.equal(false);
    expect(
      fs.existsSync(path.join(LOCAL_DIR, 'cache_test_3', 'key4', '8kb'))
    ).to.equal(true);
  });
});
