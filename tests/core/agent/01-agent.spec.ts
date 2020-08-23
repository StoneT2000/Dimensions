import * as Dimension from '../../../src';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from 'sinon-chai';
import 'mocha';
import { Logger } from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import {
  AgentDirectoryError,
  AgentFileError,
} from '../../../src/DimensionError';
chai.should();
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset);

process.setMaxListeners(20);

describe('Testing Agent', () => {
  let dimension: Dimension.DimensionType;
  before(() => {
    let rpsDesign = new RockPaperScissorsDesign('RPS');
    dimension = Dimension.create(rpsDesign, {
      activateStation: false,
      observe: false,
      loggingLevel: Logger.LEVEL.NONE,
      id: 'abcdef',
      defaultMatchConfigs: {
        storeErrorLogs: false,
      },
    });
  });

  describe('Testing Agent Errors', () => {
    it('should throw directory errors', () => {
      expect(() => {
        new Dimension.Agent('./fake_folder/afile.js', { id: 0 });
      }).to.throw(AgentDirectoryError);
    });
    it('should throw file errors', () => {
      expect(() => {
        new Dimension.Agent('./tests/afake_file.js', { id: 0 });
      }).to.throw(AgentFileError);
    });
  });

  describe('Testing Agent Initialization', () => {
    it('should work in non-securemode', () => {
      let a = new Dimension.Agent('./tests/kits/js/normal/rock.js', {
        id: 0,
        secureMode: false,
      });
      validateAgent(a, { id: 0, secureMode: false });
    });
    it('should work in securemode', () => {
      let a = new Dimension.Agent('./tests/kits/js/normal/rock.js', {
        id: 0,
        secureMode: true,
      });
      validateAgent(a, { id: 0, secureMode: true });
    });
  });
});

const validateAgent = (a: Dimension.Agent, providedConfigs: any) => {
  let vals = Dimension.Agent.OptionDefaults;
  for (let key in providedConfigs) {
    vals[key] = providedConfigs[key];
  }
  expect(a.isTerminated()).to.equal(false);
  expect(a.options).to.containSubset(vals);
};
