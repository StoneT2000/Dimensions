import * as Dimension from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from "sinon-chai";
import sinon, { SinonSandbox, SinonSpy } from "sinon";
import 'mocha';
import { Logger, Match, Design } from '../../../src';
import { deepCopy } from '../../../src/utils/DeepCopy';
import { stripFunctions } from '../utils/stripfunctions';
import { createCustomDesign } from '../utils/createCustomDesign';
import { fail } from 'assert';
const expect = chai.expect;
chai.should()
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset);

describe('Testing Match Core', () => {
  const paper = './tests/kits/js/normal/paper.js';
  const rock = './tests/kits/js/normal/rock.js'
  const botList = [rock, paper];
  const rpsDesign = new RockPaperScissorsDesign('RPS');
  const d = Dimension.create(rpsDesign, {
    activateStation: false,
    observe: false,
    id: "12345678",
    loggingLevel: Logger.LEVEL.NONE,
    defaultMatchConfigs: {
      bestOf: 9
    }
  });
  describe("Test configurations", () => {
    it("should be initialized correctly to the dimension defaults", async () => {
      // create match goes to as far as running initalize functions
      let match = await d.createMatch(botList);
      let deeped = stripFunctions(deepCopy(d.configs.defaultMatchConfigs));
      expect(match.configs).to.containSubset(deeped);
    });
  });

  describe("Test initialization", () => {
    let match: Match;
    let sandbox: SinonSandbox;
    let designInitializeSpy: SinonSpy;
    before(async () => {
      sandbox = sinon.createSandbox();
      designInitializeSpy = sandbox.spy(d.design, 'initialize');
      match = await d.createMatch(botList);
    });
    it("should generate 2 agents for a 2 agent RPS match", () => {
      expect(match.agents.length).to.equal(2);
    });
    it("should call initialization function of the design", () => {
      expect(designInitializeSpy).to.callCount(1);
    });
    it("match should have ready status", () => {
      expect(match.matchStatus).to.equal(Match.Status.READY);
    });
  });

  const testRunStopMatch = async (match: Match) => {
    expect(match.matchStatus).to.equal(Match.Status.READY);
    match.run().catch(() => {});
    return new Promise((res, rej) => {
      setTimeout(async () => {
        try {
          expect(match.matchStatus).to.equal(Match.Status.RUNNING);
          await match.stop();
          expect(match.matchStatus).to.equal(Match.Status.STOPPED);
          await match.resume();
          expect(match.matchStatus).to.equal(Match.Status.RUNNING);
          res();
        }
        catch(err) {
          rej(err);
        }
        await match.destroy();
      }, 100);
    });
    
  }
  describe("Test running", () => {
    it("should run correctly", async () => {
      let match = await d.createMatch(botList, {
        bestOf: 9,
      });
      let results = await match.run();
      expect(results.scores).to.eql({'0': 0, '1': 9});
    });

    it("should resume and stop correctly", async () => {
      let match = await d.createMatch(botList, {
        bestOf: 1001
      });
      await testRunStopMatch(match);
    });
    it('should throw errors trying to stop/resume when not allowed', async () => {
      let match = await d.createMatch(botList, {
        bestOf: 1001
      });
      expect(match.matchStatus).to.equal(Match.Status.READY);
      await expect(match.resume()).to.be.rejectedWith(Dimension.MatchWarn);
      match.run().catch(() => {});

      const timer = () => {
        return new Promise((res, rej) => {
          setTimeout(async () => {
            try {
              expect(match.matchStatus).to.equal(Match.Status.RUNNING);
              await expect(match.resume()).to.be.rejectedWith(Dimension.MatchWarn);
              await match.stop();
      
              await expect(match.stop()).to.be.rejectedWith(Dimension.MatchWarn);
              expect(match.matchStatus).to.equal(Match.Status.STOPPED);
              await match.resume();
              
      
              expect(match.matchStatus).to.equal(Match.Status.RUNNING);
              res();
            }
            catch(err) {
              rej(err);
            }
            await match.destroy();
          }, 100);
        })
      }
      await timer();
    });
  });

  

  describe("Test secureMode", () => {
    it("should initialize correctly", async () => {
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
        secureMode: true
      });
      let results = await match.run();
      expect(results.scores).to.eql({'0': 0, '1': 11});
    });

    it("should resume and stop correctly", async () => {
      let match = await d.createMatch(botList, {
        bestOf: 1001,
      });
      await testRunStopMatch(match);
    });
  });

  describe("Test custom designs", () => {
    let custom: Design;
    let d: Dimension.DimensionType;
    before(() => {
      custom = createCustomDesign();
      d = Dimension.create(custom, {
        activateStation: false,
        observe: false,
        loggingLevel: Logger.LEVEL.NONE
      });
    });

    it("should run correctly", async () => {
      let results = await d.runMatch(botList);
      expect(results).to.eql({ranks: [{agentID: 0, rank: 1}, {agentID: 1, rank: 2}] })
    });

    it("should resume and stop correctly", async () => {
      let match = await d.createMatch(botList);
      await testRunStopMatch(match);
    });
  });
  

  after(() => {
    d.cleanupMatches();
  });
  
});