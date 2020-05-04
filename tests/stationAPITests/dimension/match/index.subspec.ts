import * as Dimension from '../../../../src';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from "sinon-chai";
import 'mocha';
import { Station, Logger, Match, Tournament } from '../../../../src';
import axios, { AxiosResponse } from 'axios';
import { fail } from 'assert';
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiSubset);
chai.use(chaiAsPromised);

let origin = 'http://localhost:9000';
const RockPaperScissorsDesign = require('../../../rps').RockPaperScissorsDesign;
let rps = new RockPaperScissorsDesign('rps');
let dim: Dimension.DimensionType;
let station: Station;
let bots = ['./tests/js-kit/rps/rock.js', './tests/js-kit/rps/paper.js'];
describe('Test dimensions/match', () => {
  before(() => {
    dim = Dimension.create(rps, {
      loggingLevel: Logger.LEVEL.ERROR
    });
    station = dim.getStation();
  });
  it('GET /api/dimensions/:dimensionID/match - should return all matches', (done) => {
    let match = dim.createMatch(bots, {
      bestOf: 3
    }).then((match) => {
      axios.get(`${origin}/api/dimensions/${dim.id}/match`).then((res) => {
        let data = res.data;
        expect(data.error).to.be.equal(null);
        
        let match0: Match = <Match>data.matches[match.id];

        match.agents.forEach((agent, i) => {
          expect(agent.id).to.be.equal(match0.agents[i].id);
          expect(agent.src).to.be.equal(match0.agents[i].src);
          expect(agent.tournamentID).to.be.equal(match0.agents[i].tournamentID);
        });
        expect(match.id).to.be.equal(match0.id);
        match.destroy();
        done();
      });
    });
  });
  it('GET /api/dimensions/:dimensionID/match/:matchID - should return a match', (done) => {
    let match = dim.createMatch(bots, {
      bestOf: 3
    }).then((match) => {
      axios.get(`${origin}/api/dimensions/${dim.id}/match/${match.id}`).then((res) => {
        let data = res.data;
        expect(data.error).to.be.equal(null);
        
        let match0: Match = <Match>data.match;
        match.agents.forEach((agent, i) => {
          expect(agent.id).to.be.equal(match0.agents[i].id);
          expect(agent.src).to.be.equal(match0.agents[i].src);
          expect(agent.tournamentID).to.be.equal(match0.agents[i].tournamentID);
        });
        expect(match.id).to.be.equal(match0.id);
        match.destroy();
        done();
      });
    });
  });
  it('GET /api/dimensions/:dimensionID/match/:matchID/results - should return match results', (done) => {
    dim.createMatch(bots, {
      bestOf: 3
    }).then( async (match) => {
      let results = await match.run();
      let res = await axios.get(`${origin}/api/dimensions/${dim.id}/match/${match.id}/results`).then((res) => {
        let data = res.data;
        expect(data.error).to.be.equal(null);
        
        expect(results).to.be.eql(res.data.results);
        match.destroy();
        done();
      });
    });
  });
  it('GET /api/dimensions/:dimensionID/match/:matchID/state - should return match state', (done) => {
    dim.createMatch(bots, {
      bestOf: 3
    }).then( async (match) => {
      let res = await axios.get(`${origin}/api/dimensions/${dim.id}/match/${match.id}/state`).then((res) => {
        let data = res.data;
        expect(data.error).to.be.equal(null);
        expect(match.state).to.be.eql(res.data.state);
        match.destroy();
        done();
      });
    });
  });
  it('POST /api/dimensions/:dimensionID/match/:matchID/run - should run the match ', (done) => {
    dim.createMatch(bots, {
      bestOf: 10001
    }).then( async (match) => {
      axios.post(`${origin}/api/dimensions/${dim.id}/match/${match.id}/run`).then((res) => {
        expect(match.matchStatus).to.be.equal(Match.Status.RUNNING);
        match.destroy()
        done();
      });
    });
  });
  describe('POST /api/dimensions/:dimensionID/match/:matchID/stop - should stop the match ', () => {
    it('should stop a match', (done) =>{
      dim.createMatch(bots, {
        bestOf: 10001
      }).then( async (match) => {
        match.run().catch(() => {});
        axios.post(`${origin}/api/dimensions/${dim.id}/match/${match.id}/stop`).then((res) => {
          expect(match.matchStatus).to.be.equal(Match.Status.STOPPED);
          match.destroy()
          done();
        })
      });
    });
    it('shouldn\'t stop a match marked as ready', (done) =>{
      dim.createMatch(bots, {
        bestOf: 5
      }).then( async (match) => {
        // match.run().catch(() => {});
        axios.post(`${origin}/api/dimensions/${dim.id}/match/${match.id}/stop`).catch((res) => {
          let data = res.response.data;
          expect(data.error.status).to.be.equal(400);
          expect(data.error.message).to.be.equal('Match hasn\'t started and can\'t be stopped as a result');
          match.destroy();
          done();
        });
        
      });
    });
    it('shouldn\'t stop a match marked as finished', (done) =>{
      dim.createMatch(bots, {
        bestOf: 5
      }).then( async (match) => {
        station.setLogLevel(Logger.LEVEL.ERROR);
        await match.run();
        axios.post(`${origin}/api/dimensions/${dim.id}/match/${match.id}/stop`).catch((res) => {
          let data = res.response.data;
          expect(data.error.status).to.be.equal(400);
          expect(data.error.message).to.be.equal('Match is already finished');
          match.destroy();
          station.setLogLevel(Logger.LEVEL.NONE);
          done();
        });
        
      });
    });
  });
  
});
