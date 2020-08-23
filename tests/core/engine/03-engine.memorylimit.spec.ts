import * as Dimension from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';
import 'mocha';
import { Logger, Match, MatchEngine, Agent } from '../../../src';
import { DeepPartial } from '../../../src/utils/DeepPartial';
const expect = chai.expect;
chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset);

describe('Testing MatchEngine Memory Limit Mechanism', () => {
  let d: Dimension.DimensionType;
  const rpsDesign = new RockPaperScissorsDesign('RPS');
  const tf = [true, false];
  before(() => {
    d = Dimension.create(rpsDesign, {
      activateStation: false,
      observe: false,
      loggingLevel: Logger.LEVEL.NONE,
      defaultMatchConfigs: {
        storeErrorLogs: false,
      },
    });
  });
  describe('Test memory limit mechanism', () => {
    // TODO: add tests for bot that timeout before match starts
    for (const bool of tf) {
      it(`should kill bots accordingly if past memory limit; secureMode: ${bool}`, async () => {
        const match = await d.createMatch(
          [
            './tests/kits/js/normal/rock.exceedmemory.js',
            './tests/kits/js/normal/paper.js',
          ],
          {
            bestOf: 1001, // longer match time to gurantee memory is checked
            secureMode: bool,
            engineOptions: {
              memory: {
                limit: 1024 * 1024 * 50,
              },
            },
          }
        );
        const results = await match.run();
        expect(results.terminated[0]).to.equal('terminated');
        expect(results.terminated[1]).to.equal(undefined);
      });
    }

    // TODO, investigate why circleci can't get this passing
    it.skip('should allow for custom memory limit reached functions', async () => {
      let customRan = false;
      const customEngineOptions: DeepPartial<MatchEngine.EngineOptions> = {
        memory: {
          limit: 1024 * 1024 * 4,
          memoryCallback: (
            agent: Agent,
            match: Match,
            engineOptions: MatchEngine.EngineOptions
          ) => {
            match.kill(agent.id);
            match.log.detail(
              `custom message! - agent ${agent.id} - '${agent.name}' reached max memory!`
            );
            customRan = true;
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
          './tests/kits/js/normal/rock.exceedmemory.js',
          './tests/kits/js/normal/paper.js',
        ],
        {
          bestOf: 1001,
          engineOptions: customEngineOptions,
        }
      );
      const killSpy = sandbox.spy(match, 'kill');
      const results = await match.run();
      expect(results.terminated[0]).to.equal('terminated');
      expect(killSpy).to.be.calledWith(0);
      expect(customRan).to.equal(true, 'custom memory callback ran');
    });

    it('should allow for turning off memory limit', async () => {
      const match = await d.createMatch(
        ['./tests/kits/js/normal/rock.js', './tests/kits/js/normal/paper.js'],
        {
          bestOf: 9,
          engineOptions: {
            memory: {
              active: false,
              limit: 100,
            },
          },
        }
      );
      const sandbox = sinon.createSandbox();
      const killSpy = sandbox.spy(match, 'kill');
      const results = await match.run();
      // match.kill should never get called
      expect(killSpy).to.be.callCount(0);
      expect(results.scores).to.eql({ '0': 0, '1': 9 });
    });
  });
  after(async () => {
    await d.cleanup();
  });
});
