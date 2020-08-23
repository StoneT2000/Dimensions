import * as Dimension from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from 'sinon-chai';
import 'mocha';
import { Logger } from '../../../src';
import { createElimTourney } from './utils';
import { noop } from '../../../src/utils';
const expect = chai.expect;
chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset);

describe('Testing Tournament Scheduler Core', () => {
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

  describe('Test ranked random', noop);

  describe('Test UniformRandom', noop);
  afterEach(() => {
    d.cleanupTournaments();
  });
});
