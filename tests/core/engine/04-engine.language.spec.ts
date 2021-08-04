import { create, DimensionType } from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import 'mocha';
import { Logger } from '../../../src';
const expect = chai.expect;
chai.should();
chai.use(chaiAsPromised);
chai.use(chaiSubset);

describe('Testing MatchEngine Multi Language Support', () => {
  let d: DimensionType;
  const rpsDesign = new RockPaperScissorsDesign('RPS');

  // For consistency and testing, the js bot throws paper and all other bots throw rock
  const bots = {
    python: './tests/kits/python/bot.py',
    js: './tests/kits/js/normal/paper.js',
    ts: './tests/kits/ts/bot.ts',
    java: './tests/kits/java/Bot.java',
    cpp: './tests/kits/cpp/bot.cpp',
    executable: './tests/kits/cpp/bot.out',
    c: './tests/kits/c/bot.c',
    go: './tests/kits/go/bot.go',
    php: './tests/kits/php/bot.php',
  };
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

  for (const bool of tf) {
    describe(`Testing langs with secureMode: ${bool}`, () => {
      describe('Test python', () => {
        it('should run', async () => {
          const results = await d.runMatch([bots.python, bots.js], {
            bestOf: 9,
            secureMode: bool,
            agentOptions: {
              runCommands: {
                '.py': ['python3'],
              },
            },
            languageSpecificAgentOptions: {
              '.py': {
                image: 'python:3.8.5-slim-buster',
              },
            },
          });
          expect(results.scores).to.eql({ '0': 0, '1': 9 });
        });
      });

      describe('Test typescript', () => {
        it('should run', async () => {
          const results = await d.runMatch([bots.ts, bots.js], {
            secureMode: bool,
            bestOf: 9,
          });
          expect(results.scores).to.eql({ '0': 0, '1': 9 });
        });
      });

      describe('Test java', () => {
        it('should run', async () => {
          const results = await d.runMatch([bots.java, bots.js], {
            bestOf: 9,
            secureMode: bool,
            languageSpecificAgentOptions: {
              '.go': {
                image: 'openjdk',
              },
            },
          });
          expect(results.scores).to.eql({ '0': 0, '1': 9 });
        });
      });
      describe('Test c++', () => {
        it('should run', async () => {
          const results = await d.runMatch([bots.cpp, bots.js], {
            bestOf: 9,
            secureMode: bool,
          });
          expect(results.scores).to.eql({ '0': 0, '1': 9 });
        });
        if (bool === false) {
          it('should run compiled executable as well', async () => {
            const results = await d.runMatch([bots.executable, bots.js], {
              bestOf: 9,
              secureMode: bool,
            });
            expect(results.scores).to.eql({ '0': 0, '1': 9 });
          });
        }
      });

      describe('Test c', () => {
        it('should run', async () => {
          const results = await d.runMatch([bots.c, bots.js], {
            bestOf: 9,
            secureMode: bool,
            languageSpecificAgentOptions: {
              '.go': {
                image: 'gcc',
              },
            },
          });
          expect(results.scores).to.eql({ '0': 0, '1': 9 });
        });
      });

      describe('Test go', () => {
        it('should run', async () => {
          const results = await d.runMatch([bots.go, bots.js], {
            bestOf: 9,
            secureMode: bool,
            languageSpecificAgentOptions: {
              '.go': {
                image: 'golang',
              },
            },
          });
          expect(results.scores).to.eql({ '0': 0, '1': 9 });
        });
      });

      describe('Test php', () => {
        it('should run', async () => {
          const results = await d.runMatch([bots.php, bots.js], {
            bestOf: 9,
            secureMode: bool,
            languageSpecificAgentOptions: {
              '.go': {
                image: 'php',
              },
            },
          });
          expect(results.scores).to.eql({ '0': 0, '1': 9 });
        });
      });
    });
  }
  after(async () => {
    await d.cleanup();
    console.log('cleaned up');
  });
});
