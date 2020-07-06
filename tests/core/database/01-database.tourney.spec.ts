import * as Dimension from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from "sinon-chai";
import 'mocha';
import { Logger, MongoDB, Tournament } from '../../../src';
import { sleep } from '../utils/sleep';
import { createLadderTourney, createLadderELOTourney } from '../tourney/utils';
import { Ladder } from '../../../src/Tournament/Ladder';
const expect = chai.expect;
chai.should()
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset);

const paper = {file: './tests/kits/js/normal/paper.js', name: 'paper'};
const rock = {file: './tests/kits/js/normal/rock.js', name: 'rock'};
const disabled = {file: './tests/kits/js/normal/rock.js', name: 'disabled', existingID:'disabled'};

const users = {
  rock1: {file: './tests/kits/js/normal/rock.js', name: 'rock1', existingID:'rock1'},
  rock2: {file: './tests/kits/js/normal/rock.js', name: 'rock2', existingID:'rock2'},
  rock3: {file: './tests/kits/js/normal/rock.js', name: 'rock3', existingID:'rock3'},
}

const paperBot = {file: './tests/kits/js/normal/paper.js', name: 'paperbot', existingID: 'paperbot'};
const botList = [rock, paper];
const userBotList = [disabled, users.rock1, users.rock2, paperBot];

describe('Testing Database with Tournament Singletons (no distribution)', () => {

  const rpsDesign = new RockPaperScissorsDesign('RPS');
  const d = Dimension.create(rpsDesign, {
    activateStation: false,
    observe: false,
    id: "12345678",
    loggingLevel: Logger.LEVEL.NONE,
    defaultMatchConfigs: {
      bestOf: 9,
      storeErrorLogs: false
    }
  });
  let mongo = new MongoDB('mongodb://root:rootpassword@localhost:27017/test?authSource=admin&readPreference=primary');
  
  before( async () => {
    await d.use(mongo);
    console.log("set up db");
  });
  
  describe("Test running", () => {
    it("should run", async () => {
      // note, each tourney needs to be of a different id or else we lose track of one and can't clean up
      let tourney = createLadderTourney(d, botList, {
        name: "Ladder Tournament",
        id: "123456ts",
        tournamentConfigs: {
          syncConfigs: false
        }
      });
      await tourney.run();
      await sleep(2000);

      let ranks = await tourney.getRankings();
      expect(tourney.state.statistics.totalMatches).to.be.greaterThan(1);
      expect(ranks[0].player.file).to.equal(paper.file);
      expect(ranks[1].player.file).to.equal(rock.file);

    });
    it("should run elo", async () => {
      // note, each tourney needs to be of a different id or else we lose track of one and can't clean up
      let tourney = createLadderELOTourney(d, botList, {
        name: "Ladder Tournament",
        id: "123456elo",
        tournamentConfigs: {
          syncConfigs: false
        }
      });
      await tourney.run();
      await sleep(2000);

      let ranks = await tourney.getRankings();
      expect(tourney.state.statistics.totalMatches).to.be.greaterThan(1);
      expect(ranks[0].player.file).to.equal(paper.file);
      expect(ranks[1].player.file).to.equal(rock.file);

    });
    describe.only("Test on Trueskill", () => {
      let t: Ladder;
      before(() => {
        t = createLadderTourney(d, userBotList, {
          name: "Ladder Tournament",
          id: "12345ts",
          tournamentConfigs: {
            syncConfigs: false
          }
        });
      });
      it("should run with users and store user data + match data", async () => {
        await t.run();
        await sleep(5000);
        
        let ranks = await t.getRankings();
        expect(t.state.statistics.totalMatches).to.be.greaterThan(1);
        expect(ranks[0].player.tournamentID.id).to.equal(paperBot.existingID);
        let { user } = await t.getPlayerStat(paperBot.existingID)
        // check database stored value is same
        expect(user.statistics[t.getKeyName()].rankState.rating.mu).to.approximately(ranks[0].rankState.rating.mu, 0.01);
      });

      it("should reset rankings", async () => {
        await t.stop();
        await sleep(2000);
        await t.resetRankings();
        let ranks = await t.getRankings();
        let { user } = await t.getPlayerStat(paperBot.existingID)
        expect(user.statistics[t.getKeyName()].rankState.rating.mu).to.approximately(ranks[0].rankState.rating.mu, 0.01)
        expect(ranks[0].rankState.rating.mu).to.equal(t.configs.rankSystemConfigs.initialMu);
      });
    });

    describe("Test on ELO", async () => {
      let tourney = createLadderELOTourney(d, userBotList, {
        name: "Ladder Tournament",
        id: "12345elo",
        tournamentConfigs: {
          syncConfigs: false
        }
      });
      // testLadderTourneyWithDatabase(tourney);
    });
  });
    
  
  after(async () => {
    await d.cleanup();
    await mongo.db.close();
  });
});
