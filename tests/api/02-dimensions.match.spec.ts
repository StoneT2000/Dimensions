import * as Dimension from '../../src';
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from 'sinon-chai';
import 'mocha';
import { Logger, Match } from '../../src';
import { RockPaperScissorsDesign } from '../rps';
import { noop } from '../../src/utils';
chai.should();
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiSubset);
chai.use(chaiAsPromised);
chai.use(chaiHttp);

describe('Testing /api/dimensions/:dimensionID/match API', () => {
  const base = '/api/dimensions/:dimensionID';
  let origin = 'http://localhost:';
  let endpoint = '';
  let dimension: Dimension.DimensionType;
  const botList = [
    './tests/kits/js/normal/rock.js',
    './tests/kits/js/normal/paper.js',
  ];
  before(() => {
    const rpsDesign = new RockPaperScissorsDesign('RPS');
    dimension = Dimension.create(rpsDesign, {
      activateStation: true,
      observe: true,
      loggingLevel: Logger.LEVEL.NONE,
      id: 'abcdef3',
      defaultMatchConfigs: {
        storeErrorLogs: false,
      },
    });
    origin += dimension.getStation().port;
    endpoint = origin + `/api/dimensions/${dimension.id}`;
  });

  it(`GET ${base}/match - should return all matches`, async () => {
    const match1 = await dimension.createMatch(botList);
    const match2 = await dimension.createMatch(botList);
    const res = await chai.request(endpoint).get(`/match`);
    const matches = [match1, match2];
    expect(res.status).to.equal(200);
    for (const match of matches) {
      verifyMatchWithResponse(match, res.body.matches[match.id]);
    }
  });

  it(`GET ${base}/match/:matchID - should return match with id matchID`, async () => {
    const match = await dimension.createMatch(botList);
    const res = await chai.request(endpoint).get(`/match/${match.id}`);
    expect(res.status).to.equal(200);
    verifyMatchWithResponse(match, res.body.match);
  });

  it(`GET ${base}/match/:matchID - should return 400, no match found, if fake id provided`, async () => {
    const res = await chai.request(endpoint).get(`/match/fakeid`);
    expect(res.status).to.equal(400);
    expect(res.body).to.be.eql({
      error: {
        message:
          "No match found with name or id of 'fakeid' in dimension abcdef3 - 'dimension_abcdef3'",
        status: 400,
      },
    });
  });

  it(`GET ${base}/match/:matchID/results - should return match results for match with id matchID`, async () => {
    const match = await dimension.createMatch(botList);
    await match.run();
    const res = await chai.request(endpoint).get(`/match/${match.id}/results`);
    expect(res.status).to.equal(200);
    expect(match.results).to.eql(res.body.results);
  });

  it(`GET ${base}/match/:matchID/state - should return match state for match with id matchID`, async () => {
    const match = await dimension.createMatch(botList);
    await match.run();
    const res = await chai.request(endpoint).get(`/match/${match.id}/state`);
    expect(res.status).to.equal(200);
    expect(match.state).to.eql(res.body.state);
  });

  it(`POST ${base}/match/:matchID/run - should run/resume match with id matchID if match is ready or stopped`, async () => {
    const match = await dimension.createMatch(botList, {
      bestOf: 101,
    });
    expect(match.matchStatus).to.equal(Match.Status.READY);
    const res = await chai.request(endpoint).post(`/match/${match.id}/run`);
    expect(res.status).to.equal(200);
    expect(match.matchStatus).to.equal(Match.Status.RUNNING);

    await match.stop();
    expect(match.matchStatus).to.equal(Match.Status.STOPPED);
    const res2 = await chai.request(endpoint).post(`/match/${match.id}/run`);
    expect(res2.status).to.equal(200);
    expect(match.matchStatus).to.equal(Match.Status.RUNNING);
  });

  it(`POST ${base}/match/:matchID/run - should run/resume match with id matchID if match is finished`, async () => {
    const match = await dimension.createMatch(botList, {
      bestOf: 91,
    });
    try {
      await match.run();
    } catch (err) {
      // do nothing
    }
    expect(match.matchStatus).to.equal(Match.Status.FINISHED);
    match.configs.bestOf = 101;
    const res = await chai.request(endpoint).post(`/match/${match.id}/run`);

    expect(res.status).to.equal(200);
    expect(match.matchStatus).to.equal(Match.Status.RUNNING);
  });

  it(`POST ${base}/match/:matchID/run - should return 400, match already running, if match already running`, async () => {
    const match = await dimension.createMatch(botList, {
      bestOf: 101,
    });

    // run match and ignore error if it is destroyed
    match.run().catch(noop);
    const res = await chai.request(endpoint).post(`/match/${match.id}/run`);
    expect(res.status).to.equal(400);
    expect(match.matchStatus).to.equal(Match.Status.RUNNING);
    expect(res.body).to.be.eql({
      error: {
        message: 'Match is already running',
        status: 400,
      },
    });
  });

  it(`POST ${base}/match/:matchID/stop - should stop match with id matchID`, async () => {
    const match = await dimension.createMatch(botList, {
      bestOf: 9,
    });
    match.run().catch(noop);
    const res = await chai.request(endpoint).post(`/match/${match.id}/stop`);
    expect(res.status).to.equal(200);
  });

  it(`POST ${base}/match/:matchID/stop - should return 400, match can't be stopped while in uninitialized, ready, stopped, or finished conditions`, async () => {
    const match = await dimension.createMatch(botList, {
      bestOf: 101,
    });

    match.matchStatus = Match.Status.UNINITIALIZED;
    let res = await chai.request(endpoint).post(`/match/${match.id}/stop`);
    expect(res.status).to.equal(400);
    expect(res.body).to.be.eql({
      error: {
        message: "Can't stop an uninitialized match",
        status: 400,
      },
    });
    expect(match.matchStatus).to.equal(Match.Status.UNINITIALIZED);

    match.matchStatus = Match.Status.READY;
    res = await chai.request(endpoint).post(`/match/${match.id}/stop`);
    expect(res.status).to.equal(400);
    expect(match.matchStatus).to.equal(Match.Status.READY);
    expect(res.body).to.be.eql({
      error: {
        message: "Match hasn't started and can't be stopped as a result",
        status: 400,
      },
    });
    const runPromise = match.run().catch(noop);
    await match.stop();
    expect(match.matchStatus).to.equal(Match.Status.STOPPED);
    res = await chai.request(endpoint).post(`/match/${match.id}/stop`);
    expect(res.status).to.equal(400);
    expect(match.matchStatus).to.equal(Match.Status.STOPPED);
    expect(res.body).to.be.eql({
      error: {
        message: 'Match is already stopped',
        status: 400,
      },
    });
    await match.resume();
    expect(match.matchStatus).to.equal(Match.Status.RUNNING);
    await runPromise;
    expect(match.matchStatus).to.equal(Match.Status.FINISHED);
    res = await chai.request(endpoint).post(`/match/${match.id}/stop`);
    expect(res.status).to.equal(400);
    expect(match.matchStatus).to.equal(Match.Status.FINISHED);
    expect(res.body).to.be.eql({
      error: {
        message: 'Match is already finished',
        status: 400,
      },
    });
  });

  // TODO
  // it(`GET ${base}/match/:matchID/replay - should return match replay for match with id matchID`, async () => {
  // });

  afterEach(async () => {
    await dimension.cleanupMatches();
  });
});

const verifyMatchWithResponse = (match: Match, responseMatch: any) => {
  // remove dates because they are stored as strings in api response
  delete responseMatch.agents[0].creationDate;
  delete responseMatch.agents[1].creationDate;
  expect(match.agents).to.containSubset(responseMatch.agents);
  expect(match.configs).to.containSubset(responseMatch.configs);
};
