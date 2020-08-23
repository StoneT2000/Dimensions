import * as Dimension from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from 'sinon-chai';
import 'mocha';
import { Logger } from '../../../src';
import { createElimTourney } from './utils';
const expect = chai.expect;
chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset);

describe('Testing Elimination Tournament Core', () => {
  const paper = { file: './tests/kits/js/normal/paper.js', name: 'paper' };
  const rock = { file: './tests/kits/js/normal/rock.js', name: 'rock' };
  const botList = [rock, paper];
  const rpsDesign = new RockPaperScissorsDesign('RPS');
  const d = Dimension.create(rpsDesign, {
    activateStation: false,
    observe: false,
    id: '12345678',
    loggingLevel: Logger.LEVEL.NONE,
    defaultMatchConfigs: {
      bestOf: 9,
      storeErrorLogs: false,
    },
  });

  describe('Test running', () => {
    it('should run', async () => {
      let tourney = createElimTourney(d, [...botList, rock, rock]);
      await tourney.run();
      let ranks = tourney.getRankings();
      expect(ranks[0].rank).to.equal(1);
      expect(ranks[1].rank).to.equal(2);
      expect(ranks[2].rank).to.equal(4);
      expect(ranks[3].rank).to.equal(4);
      expect(ranks[0].losses).to.equal(0);
      expect(ranks[0].wins).to.equal(2);

      // losers of first round play 1 game
      expect(ranks[2].losses).to.equal(1);
      expect(ranks[3].losses).to.equal(1);
      expect(tourney.state.statistics.totalMatches).to.equal(3);
    });
  });
  afterEach(() => {
    d.cleanupTournaments();
  });
});
