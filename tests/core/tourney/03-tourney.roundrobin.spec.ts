import * as Dimension from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from "sinon-chai";
import sinon from "sinon";
import 'mocha';
import { Logger, MatchEngine, Match, Agent, Design, Tournament, DError } from '../../../src';
import { createRoundRobinTourney, createLadderTourney, createElimTourney, createLadderELOTourney } from './utils';
import { deepCopy } from '../../../src/utils/DeepCopy';
import { stripFunctions } from '../utils/stripfunctions';
import { createCustomDesign } from '../utils/createCustomDesign';
import { sleep } from '../utils/sleep';
import { Ladder } from '../../../src/Tournament/Ladder';
import { TournamentError } from '../../../src/DimensionError';
const expect = chai.expect;
chai.should()
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset);

describe('Testing Tournament Core', () => {
  const paper = {file: './tests/kits/js/normal/paper.js', name: 'paper'};
  const rock = {file: './tests/kits/js/normal/rock.js', name: 'rock'};
  const disabled = {file: './tests/kits/js/normal/rock.js', name: 'disabled', existingID:'disabled'};
  const testbot = {file: './tests/kits/js/normal/paper.js', name: 'test', existingID: 'test'};
  const botList = [rock, paper];
  const rpsDesign = new RockPaperScissorsDesign('RPS');
  const d = Dimension.create(rpsDesign, {
    activateStation: false,
    observe: false,
    id: "12345678",
    loggingLevel: Logger.LEVEL.NONE,
    defaultMatchConfigs: {
      bestOf: 21
    }
  });

  const testRunStopTourney = async (t: Tournament.RoundRobin) => {
    expect(t.status).to.equal(Tournament.Status.INITIALIZED);
    t.run();
    expect(t.status).to.equal(Tournament.Status.RUNNING);
    await sleep(500);
    expect(t.status).to.equal(Tournament.Status.RUNNING);
    await t.stop();
    expect(t.status).to.equal(Tournament.Status.STOPPED);
    await sleep(50);
    expect(t.status).to.equal(Tournament.Status.STOPPED);
    t.resume();
    expect(t.status).to.equal(Tournament.Status.RUNNING);
  }

  describe("Test running", () => {
    it("should run", async () => {
      let tourney = createRoundRobinTourney(d, botList);
      let res = await tourney.run();
      tourney.competitors.forEach((player) => {
        switch(player.tournamentID.name) {
          case 'paper':
            expect(res.playerStats.get(player.tournamentID.id)).to.contain({wins: 2, ties: 0, losses: 0, matchesPlayed: 2});
            break;
          case 'rock':
            expect(res.playerStats.get(player.tournamentID.id)).to.contain({wins: 0, ties: 0, losses: 2, matchesPlayed: 2});
            break;
        }
      });
      let ranks = tourney.getRankings();
      expect(ranks[0]).to.contain({name:'rock', score: 0});
      expect(ranks[1]).to.contain({name:'paper', score: 6});
    });
    it("should run and stop", async () => {
      let tourney = createRoundRobinTourney(d, botList);
      tourney.setConfigs({
        tournamentConfigs: {
          times: 10
        }
      });
      await testRunStopTourney(tourney);
      await tourney.destroy();
    });

  });
  afterEach(() => {
    d.cleanupTournaments();
  })
});