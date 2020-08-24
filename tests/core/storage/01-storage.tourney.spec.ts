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
import { noop } from '../../../src/utils';
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
  const fsstore = new FileSystemStorage();
  before(async () => {
    await d.use(mongo);
    await d.use(fsstore);
  });
  describe('Test bot upload', () => {
    it.skip('should upload and download a bot file', noop);
  });
  describe('Test error logs', () => {
    it('should upload and download error logs', async () => {
      // eslint-disable-next-line no-async-promise-executor
      return new Promise(async (resolve, reject) => {
        const tourney = createLadderTourney(d, botList, {
          name: 'Ladder Tournament',
          id: 'storagetournamenttest1',
          tournamentConfigs: {
            syncConfigs: false,
          },
          defaultMatchConfigs: {
            storeErrorDirectory: 'errorlogs/',
            storeErrorLogs: true,
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
                console.log(match.name, fsstore.bucketPath);
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
