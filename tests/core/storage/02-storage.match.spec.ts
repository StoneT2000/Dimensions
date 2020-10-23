import { create } from '../../../src';
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
  lotsOfLogs: {
    file: './tests/kits/js/normal/lotsoflogs.js',
    name: 'lotsoflogs',
  },
};

const paperBot = {
  file: './tests/kits/js/normal/paper.js',
  name: 'paperbot',
  existingID: 'paperbot',
};

describe('Testing Storage with Matches Singletons', () => {
  const rpsDesign = new RockPaperScissorsDesign('RPS');
  const d = create(rpsDesign, {
    name: 'test_storage_02',
    activateStation: false,
    observe: false,
    id: 'test_storage_02',
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
    cacheDir: 'cache_test_storage_match_tests_2',
  });
  before(async () => {
    await d.use(mongo);
    await d.use(fsstore);
  });
  it('should trim long error log files', async () => {
    const match = await d.createMatch([users.lotsOfLogs, users.lotsOfLogs], {
      storeErrorLogs: true,
      engineOptions: {
        noStdErr: false,
      },
    });
    await match.run();
    expect(fs.existsSync(path.join(fsstore.bucketPath, 'errorlogs'))).to.equal(
      true
    );
    const agent0logs = path.join(
      fsstore.bucketPath,
      'errorlogs',
      match.name,
      'agent_0.log'
    );
    const agent1logs = path.join(
      fsstore.bucketPath,
      'errorlogs',
      match.name,
      'agent_1.log'
    );
    expect(fs.existsSync(agent0logs)).to.equal(true);
    expect(fs.existsSync(agent1logs)).to.equal(true);
    const stat0 = fs.statSync(agent1logs);
    expect(stat0.size).to.be.lessThan(1e5 + 8192);
    const stat1 = fs.statSync(agent1logs);
    expect(stat1.size).to.be.lessThan(1e5 + 8192);
  });
  it('should not store empty error logs with no agent created output', async () => {
    const match = await d.createMatch([users.rock1, users.rock1], {
      storeErrorLogs: true,
      engineOptions: {
        noStdErr: false,
      },
    });
    await match.run();
    expect(fs.existsSync(path.join(fsstore.bucketPath, 'errorlogs'))).to.equal(
      true
    );
    const agent0logs = path.join(
      fsstore.bucketPath,
      'errorlogs',
      match.name,
      'agent_0.log'
    );
    const agent1logs = path.join(
      fsstore.bucketPath,
      'errorlogs',
      match.name,
      'agent_0.log'
    );
    expect(fs.existsSync(agent0logs)).to.equal(false);
    expect(fs.existsSync(agent1logs)).to.equal(false);
  });
  after(() => {
    mongo.db.close();
    d.cleanup();
  });
});
