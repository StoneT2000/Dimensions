import * as Dimension from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import path from 'path';
import fs from 'fs';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from 'sinon-chai';
import 'mocha';
import { Logger, MongoDB, Tournament } from '../../../src';
import { createLadderTourney } from '../tourney/utils';
import { FileSystemStorage } from '../../../src/SupportedPlugins/FileSystemStorage';
const expect = chai.expect;
chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset);

const users = {
  // in seed, rock1 has stats in tourneys already
  rock1: {
    file: './tests/kits/js/normal/rock.js',
    name: 'rock1',
    existingID: 'rock1',
  },
  rock2: {
    file: './tests/kits/js/normal/rock.js',
    name: 'rock2',
    existingID: 'rock2',
  },
  rock3: {
    file: './tests/kits/js/normal/rock.js',
    name: 'rock3',
    existingID: 'rock3',
  },
};

const paperBot = {
  file: './tests/kits/js/normal/paper.js',
  name: 'paperbot',
  existingID: 'paperbot',
};
const botList = [users.rock1, paperBot];

describe('Testing Storage with Tournament Singletons (no distribution)', () => {
  const rpsDesign = new RockPaperScissorsDesign('RPS');
  const d = Dimension.create(rpsDesign, {
    name: 'testname',
    activateStation: false,
    observe: false,
    id: 'test_dim_id',
    loggingLevel: Logger.LEVEL.NONE,
    defaultMatchConfigs: {
      bestOf: 5,
      storeErrorLogs: false,
    },
  });
  const mongo = new MongoDB(
    'mongodb://root:rootpassword@localhost:27017/test?authSource=admin&readPreference=primary'
  );
  const fsstore = new FileSystemStorage({
    cacheDir: 'cache_test_storage_tests_0',
  });
  before(async () => {
    await d.use(mongo);
    await d.use(fsstore);
  });
  describe('Test bot upload and download', () => {
    it('should upload and download a bot file', async () => {
      const tourney = createLadderTourney(d, botList, {
        name: 'Ladder Tournament',
        id: 'storagetournamenttest0',
        tournamentConfigs: {
          syncConfigs: false,
        },
        defaultMatchConfigs: {
          storeErrorDirectory: 'errorlogs/',
          storeErrorLogs: true,
          testReplays: true,
          storeReplayDirectory: 'replaydir',
        },
      });
      const user = await d.databasePlugin.getUser(users.rock1.existingID);
      const key = await fsstore.uploadTournamentFile(
        './tests/kits/js/normal/rock.zip',
        user,
        tourney
      );
      expect(fs.existsSync(path.join(fsstore.bucketPath, key))).to.equal(true);
      expect(fs.existsSync(await fsstore.getDownloadURL(key))).to.equal(true);
    });
  });
  describe('Test caching', () => {
    it('should cache bot files and use cache when possible if bots do not update', async () => {
      // eslint-disable-next-line no-async-promise-executor
      return new Promise(async (resolve, reject) => {
        const tourney = createLadderTourney(d, [users.rock1, users.rock2], {
          name: 'Ladder Tournament',
          id: 'storagetournamenttest1',
          tournamentConfigs: {
            syncConfigs: false,
          },
          defaultMatchConfigs: {
            storeErrorLogs: false,
            testReplays: false,
          },
        });
        const user1 = await d.databasePlugin.getUser(users.rock1.existingID);
        const key1 = await fsstore.uploadTournamentFile(
          './tests/kits/js/normal/rock.zip',
          user1,
          tourney
        );
        await tourney.addplayer(
          {
            file: 'rock.js',
            name: 'rock1',
            zipFile: null,
            botdir: null,
            botkey: key1,
          },
          user1.playerID
        );
        const user2 = await d.databasePlugin.getUser(users.rock2.existingID);
        const key2 = await fsstore.uploadTournamentFile(
          './tests/kits/js/normal/rock.zip',
          user2,
          tourney
        );
        await tourney.addplayer(
          {
            file: 'rock.js',
            name: 'rock2',
            zipFile: null,
            botdir: null,
            botkey: key2,
          },
          user1.playerID
        );
        await tourney.run();
        let count = 0;
        tourney.on(Tournament.Events.MATCH_HANDLED, async () => {
          if (++count > 3) {
            try {
              expect(fsstore._useCacheCount).to.equal(4);
              await tourney.destroy();
              resolve();
            } catch (err) {
              await tourney.destroy();
              reject(err);
            }
          }
        });
      });
    });
  });
  describe('Test error logs and replay files', () => {
    it('should correctly store error logs and replay files', async () => {
      // eslint-disable-next-line no-async-promise-executor
      return new Promise(async (resolve, reject) => {
        const tourney = createLadderTourney(d, botList, {
          name: 'Ladder Tournament',
          id: 'storagetournamenttest2',
          tournamentConfigs: {
            syncConfigs: false,
          },
          defaultMatchConfigs: {
            storeErrorDirectory: 'errorlogs/',
            storeErrorLogs: true,
            testReplays: true,
            storeReplayDirectory: 'replaydir',
          },
        });
        await tourney.run();
        let count = 0;
        tourney.on(Tournament.Events.MATCH_HANDLED, async () => {
          if (++count > 2) {
            try {
              expect(
                fs.existsSync(path.join(fsstore.bucketPath, 'errorlogs'))
              ).to.equal(true);
              const matches = await mongo.getPlayerMatches(
                users.rock1.existingID,
                tourney.id,
                0,
                10
              );
              for (const match of matches) {
                expect(
                  fs.existsSync(
                    path.join(
                      fsstore.bucketPath,
                      `errorlogs/match_${match.id}/agent_0.log`
                    )
                  )
                ).to.equal(true, 'error log should exist');
                expect(
                  fs.existsSync(
                    path.join(
                      fsstore.bucketPath,
                      `errorlogs/match_${match.id}/agent_1.log`
                    )
                  )
                ).to.equal(true, 'error log should exist');

                expect(
                  fs.existsSync(
                    path.join(
                      fsstore.bucketPath,
                      `replaydir/${match.id}.replay`
                    )
                  )
                ).to.equal(true, 'replay file should exist');
              }
              await tourney.destroy();
              resolve();
            } catch (err) {
              await tourney.destroy();
              reject(err);
            }
          }
        });
      });
    });
  });

  after(() => {
    mongo.db.close();
    d.cleanup();
  });
});
