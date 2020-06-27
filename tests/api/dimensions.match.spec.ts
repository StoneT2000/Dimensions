import * as Dimension from '../../src';
import { DominationDesign } from '../domination';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from "sinon-chai";
import 'mocha';
import { Station, Logger } from '../../src';
import { NanoID } from '../../src/Dimension';
import { RockPaperScissorsDesign } from '../rps';
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('Testing /api/dimensions/:dimensionID/match API', () => {
  const base = '/api/dimensions/:dimensionID';
  let origin = "http://localhost:"
  let dimension: Dimension.DimensionType, dimension2: Dimension.DimensionType
  before(() => {
    let rpsDesign = new RockPaperScissorsDesign('RPS');
    dimension = Dimension.create(rpsDesign, {
      activateStation: true,
      observe: true,
      loggingLevel: Logger.LEVEL.NONE,
      id: "abcdef"
    });
    origin += dimension.getStation().port
  });

  it(`GET ${base}/match - should`, (done) => {
    done()
  });
});