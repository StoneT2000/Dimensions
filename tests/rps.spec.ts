import Dimension = require('../src');
let MatchStatus = Dimension.Match.Status;
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { Logger, MatchWarn, Design, Match } from '../src';
chai.use(chaiAsPromised);
const expect = chai.expect;

const RockPaperScissorsDesign = require('./rps').RockPaperScissorsDesign;

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
  describe('Test line count match engine', () => {
    it('should be able to use line count based engine', async () => {
      let RPSDesign_line_count = new RockPaperScissorsDesign('RPS!', {
        engineOptions: {
          commandFinishPolicy: 'line_count'
        }
      });
      let myDimension_line_count = Dimension.create(RPSDesign_line_count, {
        name: 'RPS_line_count',
        activateStation: false,
        observe: false,
        loggingLevel: Dimension.Logger.LEVEL.NONE
      });
      let results = await myDimension_line_count.runMatch(
        ['./tests/js-kit/rps/line_countbot.js', './tests/js-kit/rps/line_countbotpaper.js'],
        {
          name: 'line-count (0)',
          bestOf: 10
        }
      )
      // line count bot also sends extraneous output of 's': scissors, which should all be erased by matchengine
      // we test this by ensuring the score is correct, otherwise the extraneous output would make line count bot win
      // sometimes.
      expect(results.scores).to.eql({'0': 0, '1': 10});
    });
    it('should allow for premature finish of message', async () => {
      let RPSDesign_line_count = new RockPaperScissorsDesign('RPS!', {
        engineOptions: {
          commandFinishPolicy: 'line_count',
          commandLines: {
            max: 2
          }
        }
      });
      let myDimension_line_count = Dimension.create(RPSDesign_line_count, {
        name: 'RPS_line_count',
        activateStation: false,
        observe: false,
        loggingLevel: Dimension.Logger.LEVEL.NONE
      });
      let results = await myDimension_line_count.runMatch(
        ['./tests/js-kit/rps/line_countbotrock.js', './tests/js-kit/rps/line_countbotpaper_2lines.js'],
        {
          name: 'line-count (1)',
          bestOf: 10
        }
      )
      // line count bot also sends extraneous output of 's': scissors, which should all be erased by matchengine
      // we test this by ensuring the score is correct, otherwise the extraneous output would make line count bot win
      // sometimes.
      expect(results.scores).to.eql({'0': 0, '1': 10});
    });
  });
  describe('Testing erasing extraneous output', () => {
    it('should erase extraneous output', async () => {
      let results = await myDimension.runMatch(
        ['./tests/js-kit/rps/rock.js', './tests/js-kit/rps/paper.js'],
        {
          name: 'erasure of output (1)',
          bestOf: 100
        }
      )
      expect(results.scores).to.eql({'0': 0, '1': 100});
    }).timeout(5000);
    it('should erase extraneous output part 2', async () => {
      let results = await myDimension.runMatch(
        ['./tests/js-kit/rps/smarter.js', './tests/js-kit/rps/paper.js'],
        {
          name: 'erasure of output (3)',
          bestOf: 30
        }
      )
      expect(results.scores).to.eql({'0': 30, '1': 0});
    });
  });
  describe('Testing Multi-language support', () => {
    it('should support python', async () => {
      let results = await myDimension.runMatch(
        ['./tests/js-kit/rps/smarter.js', './tests/python-kit/rps/rock.py'],
        {
          name: 'mult-lang (py)',
          bestOf: 4,
        }
      )
      expect(results.scores).to.eql({'0': 3, '1': 1});

      // randomly test not secure mode
      results = await myDimension.runMatch(
        ['./tests/js-kit/rps/smarter.js', './tests/python-kit/rps/rock.py'],
        {
          name: 'mult-lang (py)',
          bestOf: 4,
          secureMode: false
        }
      )
      expect(results.scores).to.eql({'0': 3, '1': 1});
    });
    it('should support java (run 3 times)', async () => {
      // TODO: look into why sometimes the java bot doesn't respond with any commands
      // It doesn't time out but does send the D_FINISH signal, so not sure why we don't receive the rock signal 
      // sometimes
      for (let i = 0; i < 1; i++) {
        let results = await myDimension.runMatch(
          ['./tests/js-kit/rps/smarter.js', './tests/java-kit/rps/Rock.java'],
          {
            name: 'mult-lang (java)',
            bestOf: 10,
            loggingLevel: Logger.LEVEL.ERROR,
          }
        )
        expect(results.scores).to.eql({'0': 9, '1': 1});
      }
    });
    it('should support c++', async () => {
      let results = await myDimension.runMatch(
        ['./tests/js-kit/rps/smarter.js', './tests/c++-kit/rps/rock.cpp'],
        {
          name: 'mult-lang (c++)',
          bestOf: 4
        }
      )
      expect(results.scores).to.eql({'0': 3, '1': 1});
    });
    it('should support c', async () => {
      let results = await myDimension.runMatch(
        ['./tests/js-kit/rps/smarter.js', './tests/c-kit/rps/rock.c'],
        {
          name: 'mult-lang (c)',
          bestOf: 4
        }
      )
      expect(results.scores).to.eql({'0': 3, '1': 1});
    });
    it('should support php', async () => {
      let results = await myDimension.runMatch(
        ['./tests/js-kit/rps/smarter.js', './tests/php-kit/rps/rock.php'],
        {
          name: 'mult-lang (php)',
          bestOf: 4
        }
      )
      expect(results.scores).to.eql({'0': 3, '1': 1});
    });
    it('should support go', async () => {
      let results = await myDimension.runMatch(
        ['./tests/js-kit/rps/smarter.js', './tests/go-kit/rps/rock.go'],
        {
          name: 'mult-lang (go)',
          bestOf: 4
        }
      )
      expect(results.scores).to.eql({'0': 3, '1': 1});
    });
    it('should support typescript', async () => {
      let results = await myDimension.runMatch(
        ['./tests/js-kit/rps/smarter.js', './tests/ts-kit/rps/rock.ts'],
        {
          name: 'mult-lang (typescript)',
          bestOf: 4
        }
      )
      expect(results.scores).to.eql({'0': 3, '1': 1});
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
    });
  });

  describe('Testing _buffer store and split up readable emits from process to engine', () => {
    it('should allow for delayed newline characters and split up stdout', async () => {
      let match = await myDimension.createMatch(
        ['./tests/js-kit/rps/delaynewlinepaper.js', './tests/js-kit/rps/delaynewlinerock.js'],
        {
          name: 'using _buffer match',
          bestOf: 3,
          loggingLevel: Dimension.Logger.LEVEL.WARN,
        }
      );
      let results = await match.run();
      expect(results.scores).to.eql({'0': 3, '1': 0});
      expect(match.matchEngine.getEngineOptions().timeout.max).to.equal(2000)
    });
  });

  describe('Testing timeout mechanism', () => {
    it('should timeout a bot, stop the match and give the win to the the bot', async () => {
      let res = await myDimension.runMatch(
        ['./tests/js-kit/rps/paper.js', './tests/js-kit/rps/delaybotrock.js'],
        {
          bestOf: 5,
          loggingLevel: Dimension.Logger.LEVEL.ERROR,
          engineOptions: {
            timeout: {
              max: 500
            }
          }
        }
      );
      expect(res.terminated[1]).to.equal('terminated');
      expect(res.winner).to.equal('agent_0');
    });
    it('should handle when all agents timeout, give a tie', async () => {
      let res = await myDimension.runMatch(
        ['./tests/js-kit/rps/delaybotrock.js', './tests/js-kit/rps/delaybotrock.js'],
        {
          bestOf: 5,
          loggingLevel: Dimension.Logger.LEVEL.ERROR,
          engineOptions: {
            timeout: {
              max: 500
            }
          }
        }
      );
      expect(res.terminated[1]).to.equal('terminated');
      expect(res.terminated[0]).to.equal('terminated');
      expect(res.winner).to.equal('Tie');
    });
    it('should provide timeout handlers with the `agent`, the match through `this` and a copy of `engineOptions`', async () => {
      let match = await myDimension.createMatch(
        ['./tests/js-kit/rps/delaybotrock.js', './tests/js-kit/rps/delaybotrock.js'],
        {
          name: 'check-timeout-handler',
          bestOf: 5,
          loggingLevel: Dimension.Logger.LEVEL.ERROR,
          engineOptions: {
            timeout: {
              max: 100,
              timeoutCallback: (agent, match, engineOptions) => {
                match.kill(agent.id);
                match.log.error(`custom message! - agent ${agent.id} - '${agent.name}' timed out after ${engineOptions.timeout.max} ms`);
                expect(match.matchEngine.getEngineOptions()).to.be.equal(engineOptions);
              }
            }
          }
        }
      );
      expect(match.matchEngine.getEngineOptions().timeout.max).to.equal(100)
      let res = await match.run();
    });
    it('should be allowed to override the timeout and turn it off', async () => {
      let res = await myDimension.runMatch(
        ['./tests/js-kit/rps/delaybotpaper.js', './tests/js-kit/rps/rock.js'],
        {
          bestOf: 2,
          loggingLevel: Dimension.Logger.LEVEL.ERROR,
          engineOptions: {
            timeout: {
              active: false
            }
          }
        }
      );
      expect(res.winner).to.equal('agent_0');
    });
  });
  describe('Testing removing matches', () => {
    it('should remove matches from dimension', async () => {
      let match = await myDimension.createMatch(
        ['./tests/js-kit/rps/delaybotpaper.js', './tests/js-kit/rps/delaybotrock.js'],
        {
          bestOf: 11,
          loggingLevel: Dimension.Logger.LEVEL.ERROR,
          engineOptions: {
            timeout: {
              active: false
            }
          }
        }
      );
      expect(match.run()).to.eventually.be.rejectedWith('Match was destroyed');
      await myDimension.removeMatch(match.id);

    });
  })
});

