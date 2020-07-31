import * as Dimension from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from "sinon-chai";
import 'mocha';
import { Logger, MongoDB, Tournament, GCloudDataStore } from '../../../src';
import { sleep } from '../utils/sleep';
import { createLadderTourney, createLadderELOTourney } from '../tourney/utils';
import { Ladder } from '../../../src/Tournament/Ladder';
import { RankSystem } from '../../../src/Tournament/RankSystem';
const expect = chai.expect;
chai.should()
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset);

const paper = {file: './tests/kits/js/normal/paper.js', name: 'paper'};
const rock = {file: './tests/kits/js/normal/rock.js', name: 'rock'};
const disabled = {file: './tests/kits/js/normal/rock.js', name: 'disabled', existingID:'disabled'};

const users = {
  // in seed, rock1 has stats in tourneys already
  rock1: {file: './tests/kits/js/normal/rock.js', name: 'rock1', existingID:'rock1'},
  rock2: {file: './tests/kits/js/normal/rock.js', name: 'rock2', existingID:'rock2'},
  rock3: {file: './tests/kits/js/normal/rock.js', name: 'rock3', existingID:'rock3'},
}

const paperBot = {file: './tests/kits/js/normal/paper.js', name: 'paperbot', existingID: 'paperbot'};
const botList = [rock, paper];
const userBotList = [disabled, users.rock2, paperBot]; // new bots to add

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
  // let datastore = new GCloudDataStore({
  //   keyFile: "./tests/keys/owneraccess.json"
  // });
  before( async () => {
    await d.use(mongo);
    // await d.use(datastore);
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
      await sleep(5000);

      let ranks = await tourney.getRankings();
      expect(tourney.state.statistics.totalMatches).to.be.greaterThan(1);
      expect(ranks[0].player.file).to.equal(paper.file);
      expect(ranks[1].player.file).to.equal(rock.file);
      // expect all players to be anonymous players as db is used, but no ids given
      expect(tourney.anonymousCompetitors.size).to.equal(2);

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
      await sleep(5000);

      let ranks = await tourney.getRankings();
      expect(tourney.state.statistics.totalMatches).to.be.greaterThan(1, "run more than 1 match");
      expect(ranks[0].player.file).to.equal(paper.file, "paper is first place");
      expect(ranks[1].player.file).to.equal(rock.file, "rock is second place");
      expect(tourney.anonymousCompetitors.size).to.equal(2, "both bots in tourney should be anonymous competitors");

    });
    describe("Test on Trueskill", () => {
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
        await sleep(15000);
        await t.stop();
        let ranks = await t.getRankings();
        expect(t.state.statistics.totalMatches).to.be.greaterThan(1, "run more than 1 match");
        expect(ranks[0].player.tournamentID.id).to.equal(paperBot.existingID, "paper bot should be first");
        let { user } = await t.getPlayerStat(paperBot.existingID);
        // check database stored value is same
        expect(user.statistics[t.getKeyName()].rankState.rating.mu)
          .to.approximately(ranks[0].rankState.rating.mu, 0.01, "user rank mu should match what was returned from getRankings");
        // there shouldn't be any anon competitors if all are using ids
        expect(t.anonymousCompetitors.size).to.equal(0, "no competitor should be anonymous if ids are provided");
      });

      it("should reset rankings", async () => {
        
        await t.resetRankings();
        let { playerStat } = await t.getPlayerStat(paperBot.existingID)
        let rankState: RankSystem.TRUESKILL.RankState = (<Tournament.Ladder.PlayerStat>playerStat).rankState;
        expect(rankState.rating.mu).to.equal(t.configs.rankSystemConfigs.initialMu, "reset ranking to initialMu")
      });
      it("should allow new bots and bot updates that the bot stats", async () => {
        await t.run();
        await sleep(5000);
        
        let { playerStat } = await t.getPlayerStat(paperBot.existingID);
        let paperbotMatchCount = playerStat.matchesPlayed;
        await t.addplayer(paperBot);
        playerStat = (await t.getPlayerStat(paperBot.existingID)).playerStat;
        expect(playerStat.matchesPlayed).to.be.lessThan(paperbotMatchCount, "updated bot should reset stats and matches played should be less than before");

        await t.addplayer(users.rock3);
        await sleep(4000);
        playerStat = (await t.getPlayerStat(users.rock3.existingID)).playerStat;
        expect(playerStat).to.be.not.equal(null, "new bot exists");

      });
    });

    describe("Test on ELO", () => {
      let t: Ladder;
      before(() => {
        t = createLadderELOTourney(d, userBotList, {
          name: "Ladder Tournament",
          id: "12345elo",
          tournamentConfigs: {
            syncConfigs: false
          }
        });
      });
      it("should run with users and store user data + match data", async () => {
        await t.run();
        await sleep(15000);
        
        let ranks = await t.getRankings();
        expect(t.state.statistics.totalMatches).to.be.greaterThan(1, "should run more than 1 match");
        expect(ranks[0].player.tournamentID.id).to.equal(paperBot.existingID, "first place should be paper bot");
        let { user } = await t.getPlayerStat(paperBot.existingID)
        // check database stored value is same
        expect(user.statistics[t.getKeyName()].rankState.rating.score).to.equal(ranks[0].rankState.rating.score, "user stored score should be same returned from getRankings");
        // there shouldn't be any anon competitors if all are using ids
        expect(t.anonymousCompetitors.size).to.equal(0, "should be no anonymous competitors");
      });

      it("should reset rankings", async () => {
        await t.stop();
        await t.resetRankings();
        let { playerStat } = await t.getPlayerStat(paperBot.existingID)
        let rankState: RankSystem.ELO.RankState = (<Tournament.Ladder.PlayerStat>playerStat).rankState;
        expect(rankState.rating.score).to.equal(t.configs.rankSystemConfigs.startingScore, "elo score should reset to startingScore");
      });
      it("should allow bots to be added and initialize / update bot stats", async () => {
        await t.run();
        await sleep(15000);
        
        let { playerStat } = await t.getPlayerStat(paperBot.existingID);
        let paperbotMatchCount = playerStat.matchesPlayed;
        // addplayer to update the bot
        await t.addplayer(paperBot);
        playerStat = (await t.getPlayerStat(paperBot.existingID)).playerStat;
        expect(playerStat.matchesPlayed).to.be.lessThan(paperbotMatchCount, "updated bot should reset stats and matches played should be less than before");

        // addplayer to add new bot
        await t.addplayer(users.rock3);
        await sleep(4000);
        playerStat = (await t.getPlayerStat(users.rock3.existingID)).playerStat;
        expect(playerStat).to.be.not.equal(null, "new bot exists");

      });
    });
  });
  
  after(async () => {
    await d.cleanup();
    await mongo.db.close();
  });
});
