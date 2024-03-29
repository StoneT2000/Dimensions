import { create, DefaultMatchEngineOptions, DimensionType } from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';
import 'mocha';
import { Logger, MatchEngine, Match, Agent, Design } from '../../../src';
import { deepCopy } from '../../../src/utils/DeepCopy';
import { stripFunctions } from '../utils/stripfunctions';
import { createCustomDesign } from '../utils/createCustomDesign';
import {
  AgentCompileTimeoutError,
  AgentInstallTimeoutError,
} from '../../../src/DimensionError';
const expect = chai.expect;
chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset);

describe('Testing MatchEngine Core', () => {
  let ddefault: DimensionType;
  let d: DimensionType;
  const paper = './tests/kits/js/normal/paper.js';
  const rock = './tests/kits/js/normal/rock.js';
  const bots = {
    python: './tests/kits/python/bot.py',
    js: './tests/kits/js/normal/paper.js',
    ts: './tests/kits/ts/bot.ts',
    java: './tests/kits/java/Bot.java',
    cpp: './tests/kits/cpp/bot.cpp',
    c: './tests/kits/c/bot.c',
    go: './tests/kits/go/bot.go',
    php: './tests/kits/php/bot.php',
  };
  const botList = [rock, paper];
  const jsWithSlowInstall = './tests/kits/js/withinstall/rock.js';
  const lineCountBotList = [
    './tests/kits/js/linecount/rock.js',
    './tests/kits/js/linecount/paper.js',
  ];
  const twoLineCountBotList = [
    './tests/kits/js/linecount/rock.2line.js',
    './tests/kits/js/linecount/paper.2line.js',
  ];
  const changedOptions = {
    engineOptions: {
      timeout: {
        max: 10000,
      },
    },
  };
  const rpsDesign = new RockPaperScissorsDesign('RPS');
  const rpsDesignChanged = new RockPaperScissorsDesign(
    'RPS changed',
    changedOptions
  );
  const rpsDesignLineCount = new RockPaperScissorsDesign('RPS changed', {
    engineOptions: {
      commandFinishPolicy: MatchEngine.COMMAND_FINISH_POLICIES.LINE_COUNT,
    },
  });
  const tf = [true, false];
  before(() => {
    ddefault = create(rpsDesign, {
      activateStation: false,
      observe: false,
      id: '123456',
      loggingLevel: Logger.LEVEL.NONE,
      defaultMatchConfigs: {
        storeErrorLogs: false,
      },
    });
    d = create(rpsDesignChanged, {
      activateStation: false,
      observe: false,
      id: '12345678',
      loggingLevel: Logger.LEVEL.NONE,
      defaultMatchConfigs: {
        storeErrorLogs: false,
      },
    });
  });
  describe('Test configurations', () => {
    it('should be initialized with a match correctly when using defaults', async () => {
      // create match goes to as far as running initalize functions
      const match = await ddefault.createMatch(botList, {
        bestOf: 9,
      });
      const deeped = stripFunctions(deepCopy(DefaultMatchEngineOptions));
      expect(match.matchEngine.getEngineOptions()).to.containSubset(deeped);
      await match.destroy();
    });
    it('should be initialized with a match correctly when using overriden', async () => {
      // create match goes to as far as running initalize functions
      const match = await d.createMatch(botList, {
        bestOf: 9,
      });
      const deeped = stripFunctions(
        deepCopy(rpsDesignChanged.getDesignOptions().engineOptions)
      );
      expect(match.matchEngine.getEngineOptions()).to.containSubset(deeped);
      await match.destroy();
    });
  });

  describe('Test initialization', async () => {
    let match: Match;
    before(async () => {
      match = await d.createMatch(botList, {
        bestOf: 9,
      });
    });
    it('should store relevant processes', () => {
      for (const agent of match.agents) {
        expect(agent._getProcess()).to.not.equal(
          null,
          'process should be stored'
        );
        expect(agent._getProcess().stdin.destroyed).to.equal(
          false,
          'stdin should not be destroyed'
        );
        expect(agent._getProcess().stdout.destroyed).to.equal(
          false,
          'stdout should not be destroyed'
        );
        expect(agent._getProcess().stderr.destroyed).to.equal(
          false,
          'stderr should not be destroyed'
        );
      }
    });
    it('should store relevant memory watcher intervals', () => {
      for (const agent of match.agents) {
        expect(agent.memoryWatchInterval).to.not.equal(
          null,
          'memory watch interval should be stored and active'
        );
      }
    });
    it('should store idToAgents map in match', () => {
      expect(match.idToAgentsMap.size).to.equal(2);
      for (const agent of match.agents) {
        expect(match.idToAgentsMap.get(agent.id)).to.equal(agent);
      }
    });
    it('should initialize all agents as running', () => {
      for (const agent of match.agents) {
        expect(agent.status).to.equal(Agent.Status.RUNNING);
      }
    });
    after(async () => {
      await match.destroy();
    });
  });

  describe('Test running', () => {
    describe('Test FINISH_SYMBOL policy', () => {
      it('should handle commands when using the default FINISH_SYMBOL policy', async () => {
        const match = await d.createMatch(botList, {
          bestOf: 11,
        });
        expect(match.matchEngine.getEngineOptions().commandStreamType).to.equal(
          MatchEngine.COMMAND_STREAM_TYPE.SEQUENTIAL
        );
        expect(
          match.matchEngine.getEngineOptions().commandFinishPolicy
        ).to.equal(MatchEngine.COMMAND_FINISH_POLICIES.FINISH_SYMBOL);
        const results = await match.run();
        expect(results.scores).to.eql({ '0': 0, '1': 11 });
        await match.destroy();
      });

      it('should erase extraneous output after finish symbol', async () => {
        const results = await d.runMatch(
          [
            './tests/kits/js/normal/rock.withextra.js',
            './tests/kits/js/normal/paper.js',
          ],
          {
            name: 'erasure of output (1)',
            bestOf: 9,
          }
        );
        // rock.withextra.js outputs an scissor afte ending turn, which if not erased would win game
        // expect paper to still win
        expect(results.scores).to.eql({ '0': 0, '1': 9 });
      });
    });

    describe('Test LINE_COUNT policy ', () => {
      let d: DimensionType;
      before(() => {
        d = create(rpsDesignLineCount, {
          activateStation: false,
          observe: false,
          id: '1234linecount',
          loggingLevel: Logger.LEVEL.NONE,
          defaultMatchConfigs: {
            storeErrorLogs: false,
          },
        });
      });
      const verifyLinecountSettings = (match: Match) => {
        expect(match.matchEngine.getEngineOptions().commandStreamType).to.equal(
          MatchEngine.COMMAND_STREAM_TYPE.SEQUENTIAL
        );
        expect(
          match.matchEngine.getEngineOptions().commandFinishPolicy
        ).to.equal(MatchEngine.COMMAND_FINISH_POLICIES.LINE_COUNT);
      };
      it('should handle commands when using the default configs', async () => {
        const match = await d.createMatch(lineCountBotList, {
          bestOf: 11,
        });
        verifyLinecountSettings(match);

        const results = await match.run();
        expect(results.scores).to.eql({ '0': 0, '1': 11 });
        await match.destroy();
      });
      it('should handle commands when setting max lines to more than 1', async () => {
        let match = await d.createMatch(twoLineCountBotList, {
          bestOf: 11,
          engineOptions: {
            commandLines: {
              max: 2,
            },
          },
        });
        verifyLinecountSettings(match);
        let results = await match.run();
        expect(results.scores).to.eql({ '0': 0, '1': 11 });

        // rock.extra.js sends a 2nd "S" after the "R", allowed by max 2, and thus wins this
        const extraOutputBotList = [
          './tests/kits/js/linecount/rock.extra.js',
          './tests/kits/js/linecount/paper.2line.js',
        ];
        match = await d.createMatch(extraOutputBotList, {
          bestOf: 11,
          engineOptions: {
            commandLines: {
              max: 2,
            },
          },
        });
        verifyLinecountSettings(match);
        results = await match.run();
        expect(results.scores).to.eql({ '0': 11, '1': 0 });
      });
    });
    it.skip('should allow stderr output from agents', async () => {
      // TODO: fix this test
      const match = await d.createMatch(
        [
          './tests/kits/js/normal/rock.withstderr.js',
          './tests/kits/js/normal/paper.js',
        ],
        {
          bestOf: 11,
          engineOptions: {
            noStdErr: false,
          },
        }
      );
      const sandbox = sinon.createSandbox();
      const stderrSpy = sandbox.spy(match.matchEngine.getLogger(), 'custom');

      const results = await match.run();
      expect(stderrSpy).to.be.called('string');
      expect(results.scores).to.eql({ '0': 0, '1': 11 });
    });
    it('should call matchEngine kill twice only for 2 agent matches', async () => {
      const match = await d.createMatch(
        ['./tests/kits/js/normal/rock.js', './tests/kits/js/normal/paper.js'],
        {
          bestOf: 9,
        }
      );
      const sandbox = sinon.createSandbox();
      const matchEngineKillSpy = sandbox.spy(match.matchEngine, 'kill');
      await match.run();
      expect(matchEngineKillSpy).to.callCount(2);
    });

    describe('Testing engine processing of agent output commands', () => {
      // specifically tests line with `agent._buffer.push(strs[strs.length - 1]);`
      it('should allow for delayed newline characters and use the _buffer store in agent correctly', async () => {
        const match = await d.createMatch(
          [
            './tests/kits/js/normal/rock.delaynewline.js',
            './tests/kits/js/normal/paper.delaynewline.js',
          ],
          {
            bestOf: 9,
          }
        );
        const results = await match.run();
        expect(results.scores).to.eql({ '0': 0, '1': 9 });
      });

      it('should ignore extra newlines if newline was already sent', async () => {
        const match = await d.createMatch(
          [
            './tests/kits/js/normal/rock.extranewlines.js',
            './tests/kits/js/normal/paper.delaynewline.js',
          ],
          {
            bestOf: 9,
          }
        );
        const results = await match.run();
        expect(results.scores).to.eql({ '0': 0, '1': 9 });
      });
    });

    describe(`Testing engine handling of agent 'close' event`, () => {
      it('should terminate the agent internally as well if agent prematurely exits', async () => {
        const match = await d.createMatch(
          ['./tests/kits/js/normal/rock.prematureexit.js', paper],
          {
            bestOf: 9,
          }
        );
        const sandbox = sinon.createSandbox();
        const matchEngineKillSpy = sandbox.spy(match.matchEngine, 'kill');
        const results = await match.run();
        expect(results.scores).to.eql({ '0': 0, '1': 1 });
        // 3 kill calls, one for premature termination and 2 are always called
        expect(matchEngineKillSpy).to.be.callCount(3);
      });
    });
  });

  describe('Test secureMode', () => {
    it('should initialize correctly', async () => {
      const match = await d.createMatch(botList, {
        bestOf: 11,
        secureMode: true,
      });
      for (const agent of match.agents) {
        expect(agent.options.secureMode).to.equal(true);
      }
      expect(match.configs.secureMode).to.equal(true);
      await match.destroy();
    });

    it('should run correctly', async () => {
      const match = await d.createMatch(botList, {
        bestOf: 11,
        secureMode: true,
      });
      const results = await match.run();
      expect(results.scores).to.eql({ '0': 0, '1': 11 });
      await match.destroy();
    });
  });

  describe('Test compilation step', () => {
    for (const bool of tf) {
      it(`should throw error for bot going over compile time limit and mark agent as crashed; secureMode: ${bool}`, async () => {
        const match = new Match(
          d.design,
          [bots.java, bots.js],
          {
            bestOf: 11,
            loggingLevel: 0,
            secureMode: bool,
            agentOptions: {
              maxCompileTime: 100,
            },
          },
          d
        );
        await expect(match.initialize()).to.be.rejectedWith(
          AgentCompileTimeoutError
        );
        expect(match.agents[0].status).to.equal(Agent.Status.CRASHED);
        expect(match.agents[1].status).to.equal(Agent.Status.KILLED);
        await match.destroy();
      });
    }
  });

  describe('Test install step', () => {
    for (const bool of tf) {
      it(`should throw error for bot going over install time limit and mark agent as crashed; secureMode: ${bool}`, async () => {
        const match = new Match(
          d.design,
          [jsWithSlowInstall, bots.js],
          {
            bestOf: 11,
            loggingLevel: 0,
            secureMode: bool,
            agentOptions: {
              maxInstallTime: 100,
            },
          },
          d
        );
        await expect(match.initialize()).to.be.rejectedWith(
          AgentInstallTimeoutError
        );
        expect(match.agents[0].status).to.equal(Agent.Status.CRASHED);
        expect(match.agents[1].status).to.equal(Agent.Status.KILLED);
        await match.destroy();
      });
    }
  });

  describe('Test custom designs', () => {
    let custom: Design;
    let d: DimensionType;
    before(() => {
      custom = createCustomDesign();
      d = create(custom, {
        activateStation: false,
        observe: false,
        loggingLevel: Logger.LEVEL.NONE,
        defaultMatchConfigs: {
          storeErrorLogs: false,
        },
      });
    });
    it('should initialize correctly', () => {
      // TODO
    });

    it('should run correctly', async () => {
      const results = await d.runMatch(botList);
      expect(results).to.eql({
        ranks: [
          { agentID: 0, rank: 1 },
          { agentID: 1, rank: 2 },
        ],
      });
    });
  });

  after(async () => {
    await d.cleanupMatches();
    await ddefault.cleanupMatches();
  });
});
