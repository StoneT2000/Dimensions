import * as Dimension from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from "sinon-chai";
import sinon from "sinon";
import 'mocha';
import { Logger, MatchEngine, Match, Agent, Design, Tournament, DError, MongoDB } from '../../../src';
import { sleep } from '../utils/sleep';
import { createLadderTourney } from '../tourney/utils';
const expect = chai.expect;
chai.should()
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset);

describe.only('Testing Database with Tournament', () => {
  const paper = {file: './tests/kits/js/normal/paper.js', name: 'paper'};
  const rock = {file: './tests/kits/js/normal/rock.js', name: 'rock'};
  const disabled = {file: './tests/kits/js/normal/rock.js', name: 'disabled', existingID:'disabled'};
  const rockBot = {file: './tests/kits/js/normal/rock.js', name: 'rockid', existingID:'rockid'};
  const rockBot2 = {file: './tests/kits/js/normal/rock.js', name: 'rockid2', existingID:'rockid2'};
  const paperBot = {file: './tests/kits/js/normal/paper.js', name: 'test', existingID: 'test'};
  const botList = [rock, paper];
  const userBotList = [disabled, rockBot, paperBot]
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
  let mongo = new MongoDB('mongodb://root:rootpassword@localhost:27017/test?authSource=admin&readPreference=primary');
  
  before( async () => {
    await d.use(mongo);

  });
  describe("Test running", () => {
    it("should run", async () => {
      let tourney = createLadderTourney(d, botList, {
        name: "Ladder Tournament",
        id: "12345"
      });
      await tourney.run();
      await sleep(2000);
      let ranks = await tourney.getRankings();
      expect(tourney.state.statistics.totalMatches).to.be.greaterThan(1);
      expect(ranks[0].player.file).to.equal(paper.file);
      expect(ranks[1].player.file).to.equal(rock.file);
    });
    it.only("should initialize with users and add users", async () => {
      let tourney = createLadderTourney(d, userBotList, {
        name: "Ladder Tournament with users",
        id: "12345"
      });
      await tourney.run();
      await sleep(2000);
    });
  });
    
  after(() => {
    d.cleanup();
    mongo.db.close();
  });
});