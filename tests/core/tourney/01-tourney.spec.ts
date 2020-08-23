import * as Dimension from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';
import 'mocha';
import {
  Logger,
  MatchEngine,
  Match,
  Agent,
  Design,
  Tournament,
} from '../../../src';
import {
  createRoundRobinTourney,
  createLadderTourney,
  createElimTourney,
} from './utils';
import { deepCopy } from '../../../src/utils/DeepCopy';
import { stripFunctions } from '../utils/stripfunctions';
import { createCustomDesign } from '../utils/createCustomDesign';
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

  describe('Test Configurations', () => {
    it('should adopt same match configs as dimension defaults', () => {
      let tourney = createLadderTourney(d, botList);
      expect(tourney.getConfigs().defaultMatchConfigs).to.eql(
        d.configs.defaultMatchConfigs
      );
      expect(tourney.getConfigs().loggingLevel).to.equal(
        d.configs.loggingLevel
      );
      expect(tourney.log.level).to.equal(d.log.level);
    });
    it('should allow overrided id, name, log level', () => {
      let tourney: Tournament = createLadderTourney(d, botList, {
        id: 'abc',
        name: 'abc_tourney',
      });
      expect(tourney.id).to.equal('abc');
      expect(tourney.name).to.equal('abc_tourney');
    });
  });

  describe('Test functions', () => {
    it('should get player stat', async () => {
      let tourney = createLadderTourney(d, [...botList, testbot]);
      await Promise.all(tourney.initialAddPlayerPromises);
      let { user, playerStat } = await tourney.getPlayerStat(
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
