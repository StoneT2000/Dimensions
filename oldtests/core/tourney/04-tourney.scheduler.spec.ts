import { create, Player, Tournament } from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from 'sinon-chai';
import 'mocha';
import { Logger } from '../../../src';
import { noop } from '../../../src/utils';
import { Scheduler } from '../../../src/Tournament/Scheduler';
// const expect = chai.expect;
chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset);

describe('Testing Tournament Scheduler Core', () => {
  // const paper = { file: './tests/kits/js/normal/paper.js', name: 'paper' };
  // const rock = { file: './tests/kits/js/normal/rock.js', name: 'rock' };
  // const botList = [rock, paper];
  const rpsDesign = new RockPaperScissorsDesign('RPS');
  const d = create(rpsDesign, {
    activateStation: false,
    observe: false,
    id: '12345678',
    loggingLevel: Logger.LEVEL.NONE,
    defaultMatchConfigs: {
      bestOf: 9,
      storeErrorLogs: false,
    },
  });

  describe('Test ranked random', noop);

  describe('Test UniformRandom', noop);

  describe('Test TrueskillVarianceWeighted', () => {
    let id = 0;
    const createPlayer = (s: number) => {
      const name = `${id}${s}`;
      const player = new Player(
        { id: `${id}`, name: name, username: name },
        `${id}`,
        '1'
      );
      id += 1;
      return player;
    };
    const createStat = (s: number) => {
      return {
        matchesPlayed: 1,
        rankState: {
          rating: {
            mu: 25,
            sigma: s,
            score: 0,
          },
        },
        player: createPlayer(s),
      };
    };
    const p: Array<Tournament.Ladder.PlayerStat> = [
      createStat(8.3333),
      createStat(1),
      createStat(1),
      createStat(1),
      createStat(1),
    ];
    const f = Scheduler.TrueskillVarianceWeighted({
      seed: 2,
      matchCount: 10,
      range: 5,
      agentsPerMatch: [2],
    });
    let highSigmaPlayCount = 0;
    f(p).forEach((match) => {
      if (match[0] === '0' || match[1] === '0') {
        highSigmaPlayCount++;
      }
    });
    // expect half of 10 matches to be id 0 as it has higher weight
    expect(highSigmaPlayCount).to.be.greaterThan(5);
  });

  afterEach(() => {
    d.cleanupTournaments();
  });
});
