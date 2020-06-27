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

  // TODO
  it(`GET ${base}/match/:matchID/replay - should return match replay for match with id matchID`, async () => {
  });

  after(() => {
    dimension.cleanup();
  });
});

const verifyMatchWithResponse = (match: Match, responseMatch: any) => {
  // remove dates because they are stored as strings in api response
  delete responseMatch.agents[0].creationDate;
  delete responseMatch.agents[1].creationDate;
  expect(match.agents).to.containSubset(responseMatch.agents);
  expect(match.configs).to.containSubset(responseMatch.configs);
}