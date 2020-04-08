import Dimension = require('../src');
let MatchStatus = Dimension.Match.Status;
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mocha';
chai.use(chaiAsPromised);
const expect = chai.expect;

const RockPaperScissorsDesign = require('./rps').RockPaperScissorsDesign;

describe('Rock Paper Scissors Run', () => {
  let RPSDesign, myDimension_line_count, RPSDesign_line_count;
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
      loggingLevel: Dimension.Logger.LEVEL.NONE
    });
    RPSDesign_line_count = new RockPaperScissorsDesign('RPS!', {
      engineOptions: {
        commandFinishPolicy: 'line_count'
      }
    });
    myDimension_line_count = Dimension.create(RPSDesign_line_count, {
      name: 'RPS_line_count',
      activateStation: false,
      observe: false,
      loggingLevel: Dimension.Logger.LEVEL.NONE
    });
  })
  it('should be able to use line count based engine', async () => {
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
  })
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
  })
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
    });
    it('should support java', async () => {
      let results = await myDimension.runMatch(
        ['./tests/js-kit/rps/smarter.js', './tests/java-kit/rps/Rock.java'],
        {
          name: 'mult-lang (java)',
          bestOf: 4
        }
      )
      expect(results.scores).to.eql({'0': 3, '1': 1});
    });
  }).timeout(5000);

  it('should log match errors', async () => {
    await myDimension.runMatch(
      ['./tests/js-kit/rps/errorBot.js', './tests/js-kit/rps/paper.js'],
      {
        name: 'log match errors (4)',
        bestOf: 5,
        loggingLevel: Dimension.Logger.LEVEL.WARN
      }
    );
  });

  it('should stop and resume smoothly multiple times without bots breaking - ' + 1, async () => {
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
    async function startStop(match, count = 0, originalResolve = undefined) {
      return new Promise((resolve, reject) => {
        setTimeout(async () => {
          if (match.stop()) {
            
          } else {

          }
          
          setTimeout(async () => {
            expect(match.matchStatus).to.equal(MatchStatus.STOPPED);
            if (match.resume()) {
              resolve();
            }
            else {
              reject();
            }
          }, 500)
        }, 100)
      });
    }
    
    await startStop(match);
    expect(match.matchStatus).to.equal(MatchStatus.RUNNING);
    await results.then((res) => {
      expect(res.scores).to.eql({'0': 1000, '1': 0});
    });
  }).timeout(5000);

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
    it('should handle all timeouts, give a tie', async () => {
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
        ['./tests/js-kit/rps/delaybotpaper.js', './tests/js-kit/rps/delaybotrock.js'],
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
})

