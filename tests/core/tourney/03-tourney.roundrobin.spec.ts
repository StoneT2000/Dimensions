import * as Dimension from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from 'sinon-chai';
import 'mocha';
import { Logger, Tournament } from '../../../src';
import { createRoundRobinTourney } from './utils';
import { sleep } from '../utils/sleep';
const expect = chai.expect;
chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset);

describe('Testing Roundrobin Tournament Core', () => {
  const paper = { file: './tests/kits/js/normal/paper.js', name: 'paper' };
  const rock = { file: './tests/kits/js/normal/rock.js', name: 'rock' };
  const botList = [rock, paper];
  const rpsDesign = new RockPaperScissorsDesign('RPS');
  const d = Dimension.create(rpsDesign, {
    activateStation: false,
    observe: false,
    id: '12345678',
    loggingLevel: Logger.LEVEL.NONE,
    defaultMatchConfigs: {
      bestOf: 9,
      storeErrorLogs: false,
    },
  });

  const testRunStopTourney = async (t: Tournament.RoundRobin) => {
    return new Promise(async (res, rej) => {
      try {
        expect(t.status).to.equal(Tournament.Status.INITIALIZED);
        t.run().catch(rej);
        expect(t.status).to.equal(Tournament.Status.RUNNING);
        await sleep(500);
        expect(t.status).to.equal(Tournament.Status.RUNNING);
        await t.stop();
        expect(t.status).to.equal(Tournament.Status.STOPPED);
        await sleep(50);
        expect(t.status).to.equal(Tournament.Status.STOPPED);
        t.resume().catch(rej);
        expect(t.status).to.equal(Tournament.Status.RUNNING);
        res();
      } catch (error) {
        rej(error);
      }
    });
  };

  describe('Test running', () => {
    it('should run', async () => {
      let tourney = createRoundRobinTourney(d, botList);
      let res = await tourney.run();
      tourney.competitors.forEach((player) => {
        switch (player.tournamentID.name) {
          case 'paper':
            expect(res.playerStats.get(player.tournamentID.id)).to.contain({
              wins: 2,
              ties: 0,
              losses: 0,
              matchesPlayed: 2,
            });
            break;
          case 'rock':
            expect(res.playerStats.get(player.tournamentID.id)).to.contain({
              wins: 0,
              ties: 0,
              losses: 2,
              matchesPlayed: 2,
            });
            break;
        }
      });
      let ranks = tourney.getRankings();
      expect(ranks[0]).to.contain({ name: 'rock', score: 0 });
      expect(ranks[1]).to.contain({ name: 'paper', score: 6 });
    });
    it('should run and stop', async () => {
      let tourney = createRoundRobinTourney(d, botList);
      tourney.setConfigs({
        tournamentConfigs: {
          times: 10,
        },
      });
      await testRunStopTourney(tourney);
      await tourney.destroy();
    });
  });
  afterEach(() => {
    d.cleanupTournaments();
  });
});
