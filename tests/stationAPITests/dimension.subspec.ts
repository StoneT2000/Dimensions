import * as Dimension from '../../src';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from "sinon-chai";
import 'mocha';
import { Station, Logger } from '../../src';
import axios, { AxiosResponse } from 'axios';
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiSubset);
chai.use(chaiAsPromised);

const origin = 'http://localhost:9000';
const RockPaperScissorsDesign = require('../rps').RockPaperScissorsDesign;
let rps = new RockPaperScissorsDesign('rps');
let dim;
let station;
describe('Test', () => {
  before(() => {
    dim = Dimension.create(rps, {
      loggingLevel: Logger.LEVEL.NONE
    });
    station = dim.getStation();
  });
  it('/api/dimensions/:dimensionID - should return correct details for dimension', (done) => {
    axios.get(`${origin}/api/dimensions/${dim.id}`).then((res) => {
      let data = res.data;
      console.log(res.data);
      expect(data.error).to.be.equal(null);
      expect(dim).to.be.containSubset(data.dimension);
      done();
    });
  });
  it('/api/dimensions/:dimensionID - should return correct details for dimension', (done) => {
    axios.get(`${origin}/api/dimensions/${dim.id}`).then((res) => {
      let data = res.data;
      console.log(res.data);
      expect(data.error).to.be.equal(null);
      expect(dim).to.be.containSubset(data.dimension);
      done();
    });
  });
});
