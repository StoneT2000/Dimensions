import * as Dimension from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from "sinon-chai";
import 'mocha';
import { Logger, Tournament, DError } from '../../../src';
import { createLadderTourney, createLadderELOTourney } from './utils';
import { sleep } from '../utils/sleep';
const expect = chai.expect;
chai.should()
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset);

describe('Testing Ladder Tournament Core', () => {
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

  const testRunStopTourney = async (t: Tournament.Ladder) => {
    expect(t.status).to.equal(Tournament.Status.INITIALIZED);
    await t.run();
    expect(t.status).to.equal(Tournament.Status.RUNNING);
    await sleep(1000);
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
      let tourney = createLadderTourney(d, botList);
      tourney.run();
      await sleep(2000);
      let ranks = await tourney.getRankings();
      expect(tourney.state.statistics.totalMatches).to.be.greaterThan(1);
      expect(ranks[0].player.file).to.equal(paper.file);
      expect(ranks[1].player.file).to.equal(rock.file);
    });
    it("should run and stop", async () => {
      let tourney = createLadderTourney(d, botList);
      await testRunStopTourney(tourney);
    });

    describe("Test disable players", () => {
      it("should disable players and throw error if player does not exist", async () => {
        let tourney = createLadderTourney(d, [...botList, disabled]);
        await Promise.all(tourney.initialAddPlayerPromises);
        await tourney.disablePlayer(disabled.existingID);
        expect((await tourney.getPlayerStat(disabled.existingID)).playerStat.player.disabled).to.equal(true);
        await 
          expect(tourney.disablePlayer('fakeid123456')).to.be.rejectedWith(DError.TournamentPlayerDoesNotExistError);
      });
      it("shouldn't run players that are disabled", async () => {
        let tourney = createLadderTourney(d, [...botList, disabled]);
        await Promise.all(tourney.initialAddPlayerPromises);
        await tourney.disablePlayer(disabled.existingID);
        await tourney.run();
        await sleep(2000);
        await tourney.stop();
        let ranks = await tourney.getRankings();
        expect(tourney.state.playerStats.get(disabled.existingID).rankState.rating.mu).to.equal(tourney.configs.rankSystemConfigs.initialMu);
        expect(ranks[0].rankState.rating.mu).to.be.greaterThan(ranks[2].rankState.rating.mu);
      });
    });

    describe("Test add/update/remove anonymous players", async () => {
      it("should add players", async () => {
        let tourney = createLadderTourney(d, [...botList, testbot]);
        await Promise.all(tourney.initialAddPlayerPromises);
        await tourney.addplayer('./tests/kits/js/normal/paper.js');
        // with no DB and users, these 2 sizes should be the same
        expect(tourney.competitors.size).to.equal(4);
        expect(tourney.anonymousCompetitors.size).to.equal(4);
      });
      it("should update players before start", async () => {
        let tourney = createLadderTourney(d, [...botList, testbot]);
        await Promise.all(tourney.initialAddPlayerPromises);
        await tourney.addplayer(testbot);
        expect(tourney.competitors.size).to.equal(3);
        expect(tourney.anonymousCompetitors.size).to.equal(3);
      });
      it("should update players mid tourney", async () => {
        let tourney = createLadderTourney(d, [...botList, testbot]);
        await tourney.run();
        await sleep(1000);
        await tourney.addplayer(testbot);
        expect(tourney.competitors.size).to.equal(3);
        expect(tourney.anonymousCompetitors.size).to.equal(3);
      });
      it("should remove players", async () => {
        let tourney = createLadderTourney(d, [...botList, testbot]);
        await Promise.all(tourney.initialAddPlayerPromises);
        await tourney.removePlayer(testbot.existingID);
        expect(tourney.competitors.size).to.equal(2);
        expect(tourney.anonymousCompetitors.size).to.equal(2);
      });
      it("should remove players mid tourney", async () => {
        let tourney = createLadderTourney(d, [...botList, testbot]);
        await tourney.run();
        await sleep(1000);
        await tourney.removePlayer(testbot.existingID);
        expect(tourney.competitors.size).to.equal(2);
      });
      it("should add and remove players", async () => {
        let tourney = createLadderTourney(d, botList);
        await tourney.run();
        expect(tourney.competitors.size).to.equal(2);
        await sleep(1000);
        await tourney.addplayer(testbot);
        expect(tourney.competitors.size).to.equal(3);
        await sleep(1000);
        await tourney.removePlayer(testbot.existingID);
        expect(tourney.competitors.size).to.equal(2);
      });
    });

    describe("Reset rankings", () => {
      it('should work for ELO', async () => {
        let tourney = createLadderELOTourney(d, botList);
        await tourney.run();
        await sleep(2000);
        await tourney.stop();
        let ranks = await tourney.getRankings();
        expect(ranks[0].rankState.rating.score).to.be.greaterThan(ranks[1].rankState.rating.score);
        await tourney.resetRankings();
        ranks = await tourney.getRankings();
        expect(ranks[0].rankState.rating.score).to.equal(ranks[1].rankState.rating.score);
      });

      it('should work for Trueskill', async () => {
        let tourney = createLadderTourney(d, botList);
        tourney.run();
        await sleep(2000);
        await tourney.stop();
        let ranks = await tourney.getRankings();
        expect(ranks[0].rankState.rating.mu).to.be.greaterThan(ranks[1].rankState.rating.mu);
        await tourney.resetRankings();
        ranks = await tourney.getRankings();
        expect(ranks[0].rankState.rating.mu).to.equal(ranks[1].rankState.rating.mu);
      })
    });

    describe("Test setting time limits and max match limits", () => {
      it("should stop after a certain time", async () => {
        let tourney = createLadderTourney(d, botList);
        tourney.setConfigs({
          tournamentConfigs: {
            endDate: new Date((new Date()).getTime() + 4000)
          }
        });
        await tourney.run();
        expect(tourney.status).to.equal(Tournament.Status.RUNNING);
        await sleep(5000);
        expect(tourney.status).to.equal(Tournament.Status.STOPPED);
      });

      it("should stop after some matches", async () => {
        let tourney = createLadderTourney(d, botList);
        tourney.setConfigs({
          tournamentConfigs: {
            maxTotalMatches: 4
          }
        });
        await tourney.run();
        while(tourney.state.statistics.totalMatches < 4) {
          expect(tourney.status).to.equal(Tournament.Status.RUNNING);
          await sleep(500);
        }
        expect(tourney.status).to.equal(Tournament.Status.STOPPED);
      });
    });
  });
  afterEach(() => {
    d.cleanupTournaments();
  })
});