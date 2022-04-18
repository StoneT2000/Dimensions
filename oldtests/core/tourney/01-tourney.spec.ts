import { create } from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from 'sinon-chai';
import 'mocha';
import { Logger, Tournament } from '../../../src';
import { createLadderTourney } from './utils';
const expect = chai.expect;
chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset);

describe('Testing Tournament Core', () => {
  const paper = './tests/kits/js/normal/paper.js';
  const rock = './tests/kits/js/normal/rock.js';
  const testbot = {
    file: './tests/kits/js/normal/paper.js',
    existingID: 'test',
  };
  const botList = [rock, paper];
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

  describe('Test Configurations', () => {
    it('should adopt same match configs as dimension defaults', () => {
      const tourney = createLadderTourney(d, botList);
      expect(tourney.getConfigs().defaultMatchConfigs).to.eql(
        d.configs.defaultMatchConfigs
      );
      expect(tourney.getConfigs().loggingLevel).to.equal(
        d.configs.loggingLevel
      );
      expect(tourney.log.level).to.equal(d.log.level);
    });
    it('should allow overrided id, name, log level', () => {
      const tourney: Tournament = createLadderTourney(d, botList, {
        id: 'abc',
        name: 'abc_tourney',
      });
      expect(tourney.id).to.equal('abc');
      expect(tourney.name).to.equal('abc_tourney');
    });
  });

  describe('Test functions', () => {
    it('should get player stat', async () => {
      const tourney = createLadderTourney(d, [...botList, testbot]);
      await Promise.all(tourney.initialAddPlayerPromises);
      const { user, playerStat } = await tourney.getPlayerStat(
        testbot.existingID
      );
      expect(user).to.equal(null);
      expect(playerStat.player.tournamentID.id).to.equal(testbot.existingID);
      expect(playerStat.player.tournamentID.username).to.equal(undefined);
    });
  });

  after(() => {
    d.cleanupTournaments();
  });
});
