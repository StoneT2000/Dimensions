import * as Dimension from '../../../src'
let MatchStatus = Dimension.Match.Status;
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { Logger, MatchWarn, Design, Match } from '../../../src';
chai.use(chaiAsPromised);
const expect = chai.expect;

import { RockPaperScissorsDesign } from '../../rps';

describe('Rock Paper Scissors Testing - Testing engine and match', () => {
  let RPSDesign: Design;
  let myDimension: Dimension.DimensionType;
  before(() => {
    RPSDesign = new RockPaperScissorsDesign('RPS!', {
      engineOptions: {
        timeout: {
          max: 2000,
        }
      }
    });
    myDimension = Dimension.create(RPSDesign, {
      name: 'RPS',
      activateStation: false,
      observe: false,
      loggingLevel: Dimension.Logger.LEVEL.NONE,
      secureMode: true
    });
    
    
  });

  describe('Test match stopping and running on dimensions based design', () => {
    it('should stop and resume smoothly multiple times without bots breaking - ' + 1, async () => {
      let match = await myDimension.createMatch(
        ['./tests/js-kit/rps/smarter.js', './tests/js-kit/rps/paper.js'],
        {
          name: 'stop and resume (5)',
          bestOf: 1000,
          loggingLevel: Dimension.Logger.LEVEL.NONE,
          engineOptions: {
            timeout: {
              max: 1000
            }
          }
        }
      )
      let results = match.run();

      // should stop and resume after a delay
      function startStop(match: Match, count = 0, originalResolve = undefined) {
        return new Promise((resolve, reject) => {
          setTimeout(async () => {
            await match.stop();
            setTimeout(async () => {
              expect(match.matchStatus).to.equal(MatchStatus.STOPPED);
              if (match.resume()) {
                resolve();
              }
              else {
                reject();
              }
            }, 500);
          }, 100);
        });
      }
      
      await startStop(match);
      expect(match.matchStatus).to.equal(MatchStatus.RUNNING);
      await results.then((res) => {
        expect(res.scores).to.eql({'0': 1000, '1': 0});
      });
    }).timeout(5000);
    it('should throw errors trying to stop/resume when not allowed', async () => {
      let match = await myDimension.createMatch(
        ['./tests/js-kit/rps/smarter.js', './tests/js-kit/rps/paper.js'],
        {
          name: 'stop and resume (5)',
          bestOf: 1000,
          loggingLevel: Dimension.Logger.LEVEL.WARN,
          engineOptions: {
            timeout: {
              max: 1000
            }
          }
        }
      )
      let results = match.run();
      expect(match.resume()).to.be.rejectedWith(MatchWarn);
      await match.stop();
      expect(match.stop()).to.be.rejectedWith(MatchWarn);
      await match.resume();
    });
  });

  describe('Testing memory limit mechanism', () => {
    it('should kill off bots by default if they go over memory', async () => {
      let res = await myDimension.runMatch(
        ['./tests/js-kit/rps/paper.js', './tests/js-kit/rps/rock.js'],
        {
          bestOf: 5,
          loggingLevel: Dimension.Logger.LEVEL.ERROR,
          engineOptions: {
            memory: {
              limit: 1000
            }
          }
        }
      );
      expect(res.terminated[0]).to.equal('terminated');
      expect(res.terminated[1]).to.equal('terminated');
      return expect(res.winner).to.equal('Tie');
    });
    it('should not kill off bots if mechanism turned off', async () => {
      let res = await myDimension.runMatch(
        ['./tests/js-kit/rps/paper.js', './tests/js-kit/rps/rock.js'],
        {
          bestOf: 5,
          loggingLevel: Dimension.Logger.LEVEL.ERROR,
          engineOptions: {
            memory: {
              active: false,
              limit: 1000
            }
          }
        }
      );
      return expect(res.winner).to.equal('agent_0');
    });
  });
});

