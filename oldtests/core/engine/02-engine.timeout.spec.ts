import { create, DimensionType } from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';
import 'mocha';
import { Logger, Match, MatchEngine, Agent } from '../../../src';
const expect = chai.expect;
chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset);

describe('Testing MatchEngine Timeout Mechanism', () => {
  let d: DimensionType;
  const rpsDesign = new RockPaperScissorsDesign('RPS');
  const tf = [true, false];
  before(() => {
    d = create(rpsDesign, {
      activateStation: false,
      observe: false,
      loggingLevel: Logger.LEVEL.NONE,
      defaultMatchConfigs: {
        storeErrorLogs: false,
      },
    });
  });
  describe('Test timeout mechanism', () => {
    // TODO: add tests for bot that timeout before match starts
    for (const bool of tf) {
      it(`should timeout bots accordingly; secureMode: ${bool}`, async () => {
        let match = await d.createMatch(
          [
            './tests/kits/js/normal/rockdelayed.js',
            './tests/kits/js/normal/paper.js',
          ],
          {
            bestOf: 11,
            engineOptions: {
              timeout: {
                max: 150,
              },
            },
          }
        );
        let results = await match.run();
        expect(results.terminated[0]).to.equal('terminated');

        match = await d.createMatch(
          [
            './tests/kits/js/normal/rockdelayed.js',
            './tests/kits/js/normal/rockdelayed.js',
          ],
          {
            bestOf: 11,
            engineOptions: {
              timeout: {
                max: 150,
              },
            },
          }
        );
        results = await match.run();
        expect(results.terminated[0]).to.equal('terminated');
        expect(results.terminated[1]).to.equal('terminated');
      });
    }

    it('should allow for custom timeout functions', async () => {
      let callbacked = false;
      const customEngineOptions = {
        timeout: {
          max: 150,
          timeoutCallback: (
            agent: Agent,
            match: Match,
            engineOptions: MatchEngine.EngineOptions
          ) => {
            match.kill(agent.id);
            callbacked = true;
            // engine options provided should be the same as the match itself
            expect(match.matchEngine.getEngineOptions()).to.be.equal(
              engineOptions
            );
          },
        },
      };
      const sandbox = sinon.createSandbox();

      const match = await d.createMatch(
        [
          './tests/kits/js/normal/rockdelayed.js',
          './tests/kits/js/normal/paper.js',
        ],
        {
          bestOf: 11,
          engineOptions: customEngineOptions,
        }
      );
      const killSpy = sandbox.spy(match, 'kill');
      const results = await match.run();
      expect(results.terminated[0]).to.equal('terminated');
      expect(killSpy).to.be.calledWithExactly(0);
      expect(callbacked).to.equal(true);
    });

    it('should allow for turning off timeout', async () => {
      const match = await d.createMatch(
        [
          './tests/kits/js/normal/rockdelayed.js',
          './tests/kits/js/normal/paper.js',
        ],
        {
          bestOf: 3,
          engineOptions: {
            timeout: {
              active: false,
            },
          },
        }
      );
      const sandbox = sinon.createSandbox();
      const killSpy = sandbox.spy(match, 'kill');
      const results = await match.run();
      // match.kill should never get called
      expect(killSpy).to.be.callCount(0);
      expect(results.scores).to.eql({ '0': 0, '1': 3 });
    });
  });
  after(async () => {
    await d.cleanup();
  });
});
