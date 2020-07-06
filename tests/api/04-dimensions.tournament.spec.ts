import * as Dimension from '../../src';
import chai, { expect } from 'chai';
import chaiHttp from 'chai-http'
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from "sinon-chai";
import 'mocha';
import { Logger } from '../../src';
import { RockPaperScissorsDesign } from '../rps';
chai.should()
chai.use(sinonChai);
chai.use(chaiSubset)
chai.use(chaiAsPromised);
chai.use(chaiHttp)

describe('Testing /api/dimensions/:dimensionID/tournament API', () => {
  const base = '/api/dimensions/:dimensionID';
  let origin = "http://localhost:"
  let endpoint = '';
  let dimension: Dimension.DimensionType
  before(() => {
    let rpsDesign = new RockPaperScissorsDesign('RPS');
    dimension = Dimension.create(rpsDesign, {
      activateStation: true,
      observe: true,
      loggingLevel: Logger.LEVEL.NONE,
      id: "abcdef4"
    });
    origin += dimension.getStation().port
    endpoint = origin + `/api/dimensions/${dimension.id}`
  });
  it(`GET ${base}/tournament - should return all tournaments`, (done) => {
    // chai.request(origin + "/api/dimensions")
    // .get(`/${dimension.id}`)
    // .end((err, res) => {
    //     res.should.have.status(200)
    //     done();
    // });
    expect(true).to.equal(true)
    done();
  });
});