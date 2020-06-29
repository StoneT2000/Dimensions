import * as Dimension from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from "sinon-chai";
import 'mocha';
import { Tournament, Logger, MatchEngine, Design, Match, Agent } from '../../../src';
import { match } from 'sinon';
import { deepCopy } from '../../../src/utils/DeepCopy';
import { stripFunctions } from '../utils/stripfunctions';
import { DeepPartial } from '../../../src/utils/DeepPartial';
const expect = chai.expect;
chai.should()
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset)

describe('Testing MatchEngine', () => {
  let ddefault: Dimension.DimensionType;
  let d: Dimension.DimensionType;
  let botList = ['./tests/js-kit/rps/rock.js', './tests/js-kit/rps/paper.js']
  let lineCountBotList = ['./tests/kits/js/linecount/rock.js', './tests/kits/js/linecount/paper.js']
  let twoLineCountBotList = ['./tests/kits/js/linecount/rock.2line.js', './tests/kits/js/linecount/paper.2line.js']
  let changedOptions = {
    engineOptions: {
      timeout: {
        max: 10000
      }
    }
  }
  let rpsDesign = new RockPaperScissorsDesign('RPS');
  let rpsDesignChanged = new RockPaperScissorsDesign('RPS changed', changedOptions);
  let rpsDesignLineCount = new RockPaperScissorsDesign('RPS changed', {
    engineOptions: {
      commandFinishPolicy: MatchEngine.COMMAND_FINISH_POLICIES.LINE_COUNT
    }
  })
  before( async () => {
    
    ddefault = Dimension.create(rpsDesign, {
      activateStation: false,
      observe: false,
      id: "123456",
      loggingLevel: Logger.LEVEL.NONE
    });
    d = Dimension.create(rpsDesignChanged, {
      activateStation: false,
      observe: false,
      id: "12345678",
      loggingLevel: Logger.LEVEL.NONE
    });
  });
  describe("Test configurations", () => {
    it("should be initialized with a match correctly when using defaults", async () => {
      // create match goes to as far as running initalize functions
      let match = await ddefault.createMatch(botList, {
        bestOf: 9
      });
      let deeped = stripFunctions(deepCopy(rpsDesign.getDesignOptions().engineOptions));
      expect(match.matchEngine.getEngineOptions()).to.containSubset(deeped);
    });
    it("should be initialized with a match correctly when using overriden", async () => {
      // create match goes to as far as running initalize functions
      let match = await d.createMatch(botList, {
        bestOf: 9
      });
      let deeped = stripFunctions(deepCopy(rpsDesignChanged.getDesignOptions().engineOptions));
      expect(match.matchEngine.getEngineOptions()).to.containSubset(deeped);
    });
  });

  describe("Test initialization", async () => {
    let match: Match
    before(async () => {
      match = await d.createMatch(botList, {
        bestOf: 9
      });
    })
    it("should store relevant processes", () => {
      for (let agent of match.agents) {
        expect(agent.process).to.not.equal(null);
        expect(agent.process.stdin.destroyed).to.equal(false)
        expect(agent.process.stdout.destroyed).to.equal(false)
        expect(agent.process.stderr.destroyed).to.equal(false)
      }
    });
    it("should store relevant memory watcher intervals", () => {
      for (let agent of match.agents) {
        expect(agent.memoryWatchInterval).to.not.equal(null);
      }
    });
    it("should store idToAgents map in match", () => {
      expect(match.idToAgentsMap.size).to.equal(2);
      for (let agent of match.agents) {
        expect(match.idToAgentsMap.get(agent.id)).to.equal(agent);
      }
    });
    it("should initialize all agents as running", () => {
      for (let agent of match.agents) {
        expect(agent.status).to.equal(Agent.Status.RUNNING);
      }
    });
  });

  describe("Test running", () => {
    describe("Test FINISH_SYMBOL policy", () => {
      it("should handle commands when using the default FINISH_SYMBOL policy", async () => {
        let match = await d.createMatch(botList, {
          bestOf: 11
        });
        expect(match.matchEngine.getEngineOptions().commandStreamType).to.equal(MatchEngine.COMMAND_STREAM_TYPE.SEQUENTIAL);
        expect(match.matchEngine.getEngineOptions().commandFinishPolicy).to.equal(MatchEngine.COMMAND_FINISH_POLICIES.FINISH_SYMBOL);
        let results = await match.run();
        expect(results.scores).to.eql({'0': 0, '1': 11});
      });
    });

    describe("Test LINE_COUNT policy ", () => {
      let d: Dimension.DimensionType;
      before(() => {
        d = Dimension.create(rpsDesignLineCount, {
          activateStation: false,
          observe: false,
          id: "1234linecount",
          loggingLevel: Logger.LEVEL.NONE
        });
      });
      const verifyLinecountSettings = (match: Match) => {
        expect(match.matchEngine.getEngineOptions().commandStreamType).to.equal(MatchEngine.COMMAND_STREAM_TYPE.SEQUENTIAL);
        expect(match.matchEngine.getEngineOptions().commandFinishPolicy).to.equal(MatchEngine.COMMAND_FINISH_POLICIES.LINE_COUNT);
      }
      it("should handle commands when using the default configs", async () => {
        let match = await d.createMatch(lineCountBotList, {
          bestOf: 11,
        });
        verifyLinecountSettings(match);
        
        let results = await match.run();
        expect(results.scores).to.eql({'0': 0, '1': 11});
      });
      it("should handle commands when setting max lines to more than 1", async () => {
        let match = await d.createMatch(twoLineCountBotList, {
          bestOf: 11,
          engineOptions: {
            commandLines: {
              max: 2
            }
          }
        });
        verifyLinecountSettings(match);
        let results = await match.run();
        expect(results.scores).to.eql({'0': 0, '1': 11});

        // rock.extra.js sends a 2nd "S" after the "R", allowed by max 2, and thus wins this
        let extraOutputBotList = ['./tests/kits/js/linecount/rock.extra.js', './tests/kits/js/linecount/paper.2line.js']
        match = await d.createMatch(extraOutputBotList, {
          bestOf: 11,
          engineOptions: {
            commandLines: {
              max: 2
            }
          }
        });
        verifyLinecountSettings(match);
        results = await match.run();
        expect(results.scores).to.eql({'0': 11, '1': 0});
      });
    });
  });

  describe("Test secureMode", () => {
    it("should run initialize correctly", async () => {
      let match = await d.createMatch(botList, {
        bestOf: 11,
        secureMode: true
      });
      for (let agent of match.agents) {
        expect(agent.options.secureMode).to.equal(true);
      }
      expect(match.configs.secureMode).to.equal(true);
    });

    it("should run correctly", async () => {
      let match = await d.createMatch(botList, {
        bestOf: 11,
        secureMode: true,
        // loggingLevel: 10
      });
      let results = await match.run();
      expect(results.scores).to.eql({'0': 0, '1': 11});
    });
  });

  after( async () => {
    d.cleanupMatches();
    ddefault.cleanupMatches();
  });
});