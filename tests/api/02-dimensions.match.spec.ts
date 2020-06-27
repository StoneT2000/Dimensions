import * as Dimension from '../../src';
import chai from 'chai';
import chaiHttp from 'chai-http'
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from "sinon-chai";
import 'mocha';
import { Logger, Match } from '../../src';
import { RockPaperScissorsDesign } from '../rps';
chai.should()
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiSubset)
chai.use(chaiAsPromised);
chai.use(chaiHttp)

describe('Testing /api/dimensions/:dimensionID/match API', () => {
  const base = '/api/dimensions/:dimensionID';
  let origin = "http://localhost:"
  let endpoint = '';
  let dimension: Dimension.DimensionType;
  let botList = ['./tests/js-kit/rps/rock.js', './tests/js-kit/rps/paper.js']
  before(() => {
    let rpsDesign = new RockPaperScissorsDesign('RPS');
    dimension = Dimension.create(rpsDesign, {
      activateStation: true,
      observe: true,
      loggingLevel: Logger.LEVEL.NONE,
      id: "abcdef3"
    });
    origin += dimension.getStation().port
    endpoint = origin + `/api/dimensions/${dimension.id}`
  });

  it(`GET ${base}/match - should return all matches`, async () => {
    let match1 = await dimension.createMatch(botList)
    let match2 = await dimension.createMatch(botList)
    const res = await chai.request(endpoint)
    .get(`/match`);
    let matches = [match1, match2]
    expect(res.status).to.equal(200)
    for (let match of matches) {
      verifyMatchWithResponse(match, res.body.matches[match.id])
    }
  });

  it(`GET ${base}/match/:matchID - should return match with id matchID`, async () => {
    let match = await dimension.createMatch(botList)
    const res = await chai.request(endpoint)
    .get(`/match/${match.id}`);
    expect(res.status).to.equal(200)
    verifyMatchWithResponse(match, res.body.match)
  });

  it(`GET ${base}/match/:matchID - should return 400, no match found, if fake id provided`, async () => {
    const res = await chai.request(endpoint)
    .get(`/match/fakeid`);
    expect(res.status).to.equal(400)
    expect(res.body).to.be.eql({
      error: {
        message: "No match found with name or id of 'fakeid' in dimension abcdef3 - 'dimension_abcdef3'",
        status: 400,
      }
    });
  });

  it(`GET ${base}/match/:matchID/results - should return match results for match with id matchID`, async () => {
    let match = await dimension.createMatch(botList)
    await match.run();
    const res = await chai.request(endpoint)
    .get(`/match/${match.id}/results`);
    expect(res.status).to.equal(200)
    expect(match.results).to.eql(res.body.results)
  });

  it(`GET ${base}/match/:matchID/state - should return match state for match with id matchID`, async () => {
    let match = await dimension.createMatch(botList)
    await match.run();
    const res = await chai.request(endpoint)
    .get(`/match/${match.id}/state`);
    expect(res.status).to.equal(200)
    expect(match.state).to.eql(res.body.state)
  });

  it(`POST ${base}/match/:matchID/run - should run/resume match with id matchID if match is ready or stopped`, async () => {
    let match = await dimension.createMatch(botList, {
      bestOf: 101
    })
    expect(match.matchStatus).to.equal(Match.Status.READY);
    const res = await chai.request(endpoint)
    .post(`/match/${match.id}/run`);
    expect(res.status).to.equal(200)
    expect(match.matchStatus).to.equal(Match.Status.RUNNING);
    
    await match.stop();
    expect(match.matchStatus).to.equal(Match.Status.STOPPED);
    const res2 = await chai.request(endpoint)
    .post(`/match/${match.id}/run`);
    expect(res2.status).to.equal(200)
    expect(match.matchStatus).to.equal(Match.Status.RUNNING);
  });

  it(`POST ${base}/match/:matchID/run - should run/resume match with id matchID if match is finished`, async () => {
    let match = await dimension.createMatch(botList, {
      bestOf: 9
    })
    try {
      await match.run()
    } catch (err) {

    }
    expect(match.matchStatus).to.equal(Match.Status.FINISHED);
    match.configs.bestOf = 101
    const res = await chai.request(endpoint)
    .post(`/match/${match.id}/run`);

    expect(res.status).to.equal(200)
    expect(match.matchStatus).to.equal(Match.Status.RUNNING);
  });

  it(`POST ${base}/match/:matchID/run - should return 400, match already running, if match already running`, async () => {
    let match = await dimension.createMatch(botList, {
      bestOf: 101
    });

    // run match and ignore error if it is destroyed
    match.run().catch(() => {})
    const res = await chai.request(endpoint)
    .post(`/match/${match.id}/run`);
    expect(res.status).to.equal(400)
    expect(match.matchStatus).to.equal(Match.Status.RUNNING);
    expect(res.body).to.be.eql({
      error: {
        message: "Match is already running",
        status: 400,
      }
    });
  });

  // TODO
  // it(`GET ${base}/match/:matchID/replay - should return match replay for match with id matchID`, async () => {
  // });

  after(async () => {
    await dimension.cleanupMatches();
  });
});

const verifyMatchWithResponse = (match: Match, responseMatch: any) => {
  // remove dates because they are stored as strings in api response
  delete responseMatch.agents[0].creationDate;
  delete responseMatch.agents[1].creationDate;
  expect(match.agents).to.containSubset(responseMatch.agents);
  expect(match.configs).to.containSubset(responseMatch.configs);
}