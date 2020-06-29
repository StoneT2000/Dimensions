import * as Dimension from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from "sinon-chai";
import sinon from "sinon";
import 'mocha';
import { Logger, Match, MatchEngine, Agent } from '../../../src';
const expect = chai.expect;
chai.should()
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset)

describe('Testing MatchEngine', () => {
  let d: Dimension.DimensionType;
  let rpsDesign = new RockPaperScissorsDesign('RPS');
  before( async () => {
    d = Dimension.create(rpsDesign, {
      activateStation: false,
      observe: false,
      loggingLevel: Logger.LEVEL.NONE
    });
  });
  describe("Test timeout mechanism", () => {
    // TODO: add tests for bot that timeout before match starts
    it("should timeout bots accordingly", async () => {
      let match = await d.createMatch(['./tests/kits/js/normal/rockdelayed.js', './tests/kits/js/normal/paper.js'], {
        bestOf: 11,
        engineOptions: {
          timeout: {
            max: 150
          }
        }
      });
      let results = await match.run();
      expect(results.terminated[0]).to.equal('terminated');

      match = await d.createMatch(['./tests/kits/js/normal/rockdelayed.js', './tests/kits/js/normal/rockdelayed.js'], {
        bestOf: 11,
        engineOptions: {
          timeout: {
            max: 150
          }
        }
      });
      results = await match.run();
      expect(results.terminated[0]).to.equal('terminated');
      expect(results.terminated[1]).to.equal('terminated');
    });

    it("should allow for custom timeout functions", async () => {
      const someMessage = "some message";
      const customEngineOptions = {
        timeout: {
          max: 150,
          timeoutCallback: (agent: Agent, match: Match, engineOptions: MatchEngine.EngineOptions) => {
            match.kill(agent.id);
            match.log.detail(`custom message! - agent ${agent.id} - '${agent.name}' timed out after ${engineOptions.timeout.max} ms`);
            match.log.detail(someMessage)
            // engine options provided should be the same as the match itself
            expect(match.matchEngine.getEngineOptions()).to.be.equal(engineOptions);
          }
        }
      }
      let sandbox = sinon.createSandbox();
      
      let match = await d.createMatch(['./tests/kits/js/normal/rockdelayed.js', './tests/kits/js/normal/paper.js'], {
        bestOf: 11,
        engineOptions: customEngineOptions
      });
      let killSpy = sandbox.spy(match, 'kill');
      let logspy = sandbox.spy(match.log, 'detail');
      let results = await match.run();
      expect(results.terminated[0]).to.equal('terminated');
      expect(killSpy).to.be.calledWithExactly(0);
      expect(logspy).to.be.callCount(2);
      expect(logspy).to.be.calledWith(someMessage);
    });

    it("should allow for turning off timeout", async () => {
      let match = await d.createMatch(['./tests/kits/js/normal/rockdelayed.js', './tests/kits/js/normal/paper.js'], {
        bestOf: 3,
        engineOptions: {
          timeout: {
            active: false
          }
        }
      });
      let sandbox = sinon.createSandbox();
      let killSpy = sandbox.spy(match, 'kill');
      let results = await match.run();
      expect(killSpy).to.be.callCount(0);
      expect(results.scores).to.eql({'0': 0, '1': 3});
    });
  });
});