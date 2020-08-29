import * as Dimension from '../../src';
import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from 'sinon-chai';
import 'mocha';
import { Logger, Tournament, MongoDB } from '../../src';
import { RockPaperScissorsDesign } from '../rps';
import { Ladder } from '../../src/Tournament/Ladder';
import { createLadderTourney } from '../core/tourney/utils';
import { copyFile, copyFileSync, mkdirSync } from 'fs';
import path from 'path';
import { LOCAL_DIR } from '../../src/utils/System';
import { FileSystemStorage } from '../../src/SupportedPlugins/FileSystemStorage';
chai.should();
chai.use(sinonChai);
chai.use(chaiSubset);
chai.use(chaiAsPromised);
chai.use(chaiHttp);

describe('Testing /api/dimensions/:dimensionID/tournaments API', () => {
  const base = '/api/dimensions/:dimensionID';
  let origin = 'http://localhost:';
  let endpoint = '';
  let dimension: Dimension.DimensionType;
  let t: Ladder;
  const paper = './tests/kits/js/normal/paper.js';
  const rock = './tests/kits/js/normal/rock.js';
  const botList = [rock, paper];
  // list of bots
  const botListWithIDs = [
    {
      file: './tests/kits/js/normal/rock.js',
      name: 'rock1',
      existingID: 'rock1',
    },
    {
      file: './tests/kits/js/normal/rock.js',
      name: 'rock2',
      existingID: 'rock2',
    },
    {
      file: './tests/kits/js/normal/rock.js',
      name: 'rock3',
      existingID: 'rock3',
    },
  ];
  const mongo = new MongoDB(
    'mongodb://root:rootpassword@localhost:27017/test?authSource=admin&readPreference=primary'
  );
  const fsstore = new FileSystemStorage();

  before(async () => {
    const rpsDesign = new RockPaperScissorsDesign('RPS');
    dimension = Dimension.create(rpsDesign, {
      activateStation: true,
      observe: true,
      loggingLevel: Logger.LEVEL.NONE,
      id: 'abcdef4',
      defaultMatchConfigs: {
        storeErrorLogs: false,
      },
      stationConfigs: {
        requireAuth: false,
      },
    });
    origin += dimension.getStation().port;
    endpoint = origin + `/api/dimensions/${dimension.id}`;
    t = createLadderTourney(dimension, botList, {
      id: 'tournamentid',
    });
    await dimension.use(mongo);
    await dimension.use(fsstore);
  });
  it(`GET ${base}/tournaments - should return all tournaments`, async () => {
    const res = await chai.request(endpoint).get(`/tournaments`);
    expect(res.status).to.equal(200);
    expect({
      error: null,
      tournaments: {
        tournamentid: t,
      },
    }).to.containSubset(res.body);
  });

  it(`GET ${base}/tournaments/:tournamentID - should return tournament with id tournamentID`, async () => {
    const res = await chai.request(endpoint).get(`/tournaments/${t.id}`);
    expect(res.status).to.equal(200);
    expect({
      error: null,
      tournament: t,
    }).to.containSubset(res.body);
  });

  it(`GET ${base}/tournaments/:tournamentID - should return 400, if tournament with id tournamentID does not exist`, async () => {
    const res = await chai
      .request(endpoint)
      .get(`/tournaments/faketournamentID`);
    expect(res.status).to.equal(400);
    expect(res.body).to.eql({
      error: {
        status: 400,
        message: `No tournament found with name or id of 'faketournamentID' in dimension ${dimension.id} - '${dimension.name}'`,
      },
    });
  });

  it(`POST ${base}/tournaments/:tournamentID/upload-by-key - should upload bot by key`, async () => {
    const t = createLadderTourney(dimension, botListWithIDs, {
      id: 'ladderTestWithUploadBykey',
      tournamentConfigs: {
        selfMatchMake: false,
      },
      defaultMatchConfigs: {
        bestOf: 9,
      },
    });
    mkdirSync(path.join(fsstore.bucketPath, 'testfolder'), {
      recursive: true,
    });
    copyFileSync(
      './tests/kits/js/normal/paper.zip',
      path.join(fsstore.bucketPath, 'testfolder/bot.zip')
    );
    const res = await chai
      .request(endpoint)
      .post(`/tournaments/${t.id}/upload-by-key`)
      .send({
        botname: 'rock2withpaper',
        botkey: 'testfolder/bot.zip',
        playerID: 'rock2',
        pathtofile: 'paper.js',
      });
    const { playerStat } = await t.getPlayerStat('rock2');
    expect(playerStat.player.botDirPath).to.equal(null);
    expect(playerStat.player.botkey).to.equal('testfolder/bot.zip');
    expect(playerStat.player.disabled).to.equal(false);
    expect(playerStat.player.file).to.equal('paper.js');
    expect(playerStat.player.zipFile).to.equal(null);
    expect(res.status).to.equal(200);
  });

  it(`POST ${base}/tournaments/:tournamentID/match-queue - should schedule matches`, async () => {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      const t = createLadderTourney(dimension, botListWithIDs, {
        id: 'ladderWithoutSelfMatchmake',
        tournamentConfigs: {
          selfMatchMake: false,
        },
        defaultMatchConfigs: {
          bestOf: 9,
        },
      });
      const matchQueue = [
        ['rock1', 'rock2'],
        ['rock2', 'rock3'],
      ];
      await t.run();
      const res = await chai
        .request(endpoint)
        .post(`/tournaments/${t.id}/match-queue`)
        .send({ matchQueue });
      expect(res.status).to.equal(200);
      expect(res.body).to.eql({
        error: null,
        message: `Queued ${matchQueue.length} matches`,
      });
      let count = 0;
      t.on(Tournament.Events.MATCH_HANDLED, async () => {
        if (++count === 2) {
          try {
            expect(t.state.playerStats.get('rock1').matchesPlayed).to.equal(1);
            expect(t.state.playerStats.get('rock2').matchesPlayed).to.equal(2);
            expect(t.state.playerStats.get('rock3').matchesPlayed).to.equal(1);
            await t.destroy();
            resolve();
          } catch (err) {
            await t.destroy();
            reject(err);
          }
        }
      });
    });
  });
  after(async () => {
    await mongo.db.close();
    await dimension.cleanup();
  });
});
