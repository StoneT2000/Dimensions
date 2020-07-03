import * as Dimension from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from "sinon-chai";
import sinon from "sinon";
import 'mocha';
import { Logger, Match, MatchEngine, Agent } from '../../../src';
import { DeepPartial } from '../../../src/utils/DeepPartial';
const expect = chai.expect;
chai.should()
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset)

describe('Testing MatchEngine Memory Limit Mechanism', () => {
  let d: Dimension.DimensionType;
  let rpsDesign = new RockPaperScissorsDesign('RPS');
  before( async () => {
    d = Dimension.create(rpsDesign, {
      activateStation: false,
      observe: false,
      loggingLevel: Logger.LEVEL.NONE
    });
  });
  describe("Test memory limit mechanism", () => {
    // TODO: add tests for bot that timeout before match starts
    it("should kill bots accordingly if past memory limit", async () => {
      let match = await d.createMatch(['./tests/kits/js/normal/rock.js', './tests/kits/js/normal/paper.js'], {
        bestOf: 11,
        engineOptions: {
          memory: {
            limit: 100
          }
        }
      });
      let results = await match.run();
      expect(results.terminated[0]).to.equal('terminated');
      expect(results.terminated[1]).to.equal('terminated');
    });

    it("should allow for custom memory limit reached functions", async () => {
      const someMessage = "some message";
      const customEngineOptions: DeepPartial<MatchEngine.EngineOptions> = {
        memory: {
          limit: 100,
          memoryCallback: (agent: Agent, match: Match, engineOptions: MatchEngine.EngineOptions) => {
            match.kill(agent.id);
            match.log.detail(`custom message! - agent ${agent.id} - '${agent.name}' reached max memory!`);
            match.log.detail(someMessage)
            // engine options provided should be the same as the match itself
            expect(match.matchEngine.getEngineOptions()).to.be.equal(engineOptions);
          }
        }
      }
      let sandbox = sinon.createSandbox();
      
      let match = await d.createMatch(['./tests/kits/js/normal/rock.js', './tests/kits/js/normal/paper.js'], {
        bestOf: 11,
        engineOptions: customEngineOptions
      });
      let killSpy = sandbox.spy(match, 'kill');
      let logspy = sandbox.spy(match.log, 'detail');
      let results = await match.run();
      expect(results.terminated[0]).to.equal('terminated');
      expect(results.terminated[1]).to.equal('terminated');
      expect(killSpy).to.be.calledWith(0);
      expect(killSpy).to.be.calledWith(1);
      expect(logspy).to.be.callCount(4);
      expect(logspy).to.be.calledWith(someMessage);
    });

    it("should allow for turning off memory limit", async () => {
      let match = await d.createMatch(['./tests/kits/js/normal/rock.js', './tests/kits/js/normal/paper.js'], {
        bestOf: 9,
        engineOptions: {
          memory: {
            active: false,
            limit: 100
          }
        }
      });
      let sandbox = sinon.createSandbox();
      let killSpy = sandbox.spy(match, 'kill');
      let results = await match.run();
      // match.kill should never get called
      expect(killSpy).to.be.callCount(0);
      expect(results.scores).to.eql({'0': 0, '1': 9});
    });
  });
  after(() => {
    d.cleanup();
  });
});