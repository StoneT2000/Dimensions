import * as Dimension from '../../../src';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from "sinon-chai";
import 'mocha';
import { Station, Logger, Match, Tournament } from '../../../src';
import axios, { AxiosResponse } from 'axios';
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiSubset);
chai.use(chaiAsPromised);

const origin = 'http://localhost:9000';
const RockPaperScissorsDesign = require('../../rps').RockPaperScissorsDesign;
let rps = new RockPaperScissorsDesign('rps');
let dim: Dimension.DimensionType;
let station;
let bots = ['./tests/js-kit/rps/rock.js', './tests/js-kit/rps/paper.js'];
describe('Test API Dimensions', () => {
  before(() => {
    dim = Dimension.create(rps, {
      loggingLevel: Logger.LEVEL.NONE
    });
    station = dim.getStation();
  });
  it('/api/dimensions/ - should return all dimensions', (done) => {
    axios.get(`${origin}/api/dimensions`).then((res) => {
      let data = res.data;
      expect(data.error).to.be.equal(null);
      expect(dim).to.be.containSubset(data.dimensions[dim.id]);
      done();
    });
  });
  it('/api/dimensions/:dimensionID - should return correct details for dimension', (done) => {
    axios.get(`${origin}/api/dimensions/${dim.id}`).then((res) => {
      let data = res.data;
      expect(data.error).to.be.equal(null);
      expect(dim).to.be.containSubset(data.dimension);
      done();
    });
  });
  it('/api/dimensions/:dimensionID/tournament - should return all tournaments', (done) => {
    let tourney = dim.createTournament(bots, {
      type: Tournament.TOURNAMENT_TYPE.ROUND_ROBIN,
      rankSystem: Tournament.RANK_SYSTEM.WINS,
      agentsPerMatch: [2],
      loggingLevel: Logger.LEVEL.NONE,
      resultHandler: RockPaperScissorsDesign.winsResultHandler
    })
    axios.get(`${origin}/api/dimensions/${dim.id}/tournament/${tourney.id}`).then((res) => {
      let data = res.data;
      expect(data.error).to.be.equal(null);
      
      let tourney0: Tournament = <Tournament>data.tournament;
      expect(tourney.configs).to.be.containSubset(tourney0.configs);
      tourney.destroy();
      done();
    });
  });
  
});
