import * as Dimension from '../../src';
import chai from 'chai';
import chaiHttp from 'chai-http'
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from "sinon-chai";
import 'mocha';
import { Logger, Match } from '../../src';
import { RockPaperScissorsDesign } from '../rps';
import MatchSchemaCreator from '../../src/SupportedPlugins/MongoDB/models/match';
chai.should()
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiSubset)
chai.use(chaiAsPromised);
chai.use(chaiHttp)

describe('Testing /api/dimensions/:dimensionID/match/:matchID/agent API', () => {
  const base = '/api/dimensions/:dimensionID/match/:matchID';
  let origin = "http://localhost:"
  let endpoint = '';
  let dimension: Dimension.DimensionType;
  let match: Dimension.Match;
  let botList = ['./tests/kits/js/normal/rock.js', './tests/kits/js/normal/paper.js']
  before( async () => {
    let rpsDesign = new RockPaperScissorsDesign('RPS');
    dimension = Dimension.create(rpsDesign, {
      activateStation: true,
      observe: true,
      loggingLevel: Logger.LEVEL.NONE,
      id: "abcdef3",
      defaultMatchConfigs: {
        storeErrorLogs: false
      }
    });
    match = await dimension.createMatch(botList)
    origin += dimension.getStation().port
    endpoint = origin + `/api/dimensions/${dimension.id}/match/${match.id}`
  });

  it(`GET ${base}/ - should return all agents`, async () => {
    const res = await chai.request(endpoint)
    .get(`/agent`);
    expect(res.status).to.equal(200)
    for (let agent of match.agents) {
      delete agent.creationDate
    }
    for (let agent of res.body.agents) {
      delete agent.creationDate
    }
    verifyAgentWithResponse(match, res)
  });

  it(`GET ${base}/:agentID - should return agent with id agentID`, async () => {
    const res = await chai.request(endpoint)
    .get(`/agent/0`);
    expect(res.status).to.equal(200)
    for (let agent of match.agents) {
      delete agent.creationDate
    }
    delete res.body.agent.creationDate
    expect(match.agents[0]).to.containSubset(res.body.agent);
  });

  it(`GET ${base}/:agentID - should return 400, if agent with id agentID does not exist`, async () => {
    const res = await chai.request(endpoint)
    .get(`/agent/20`);
    expect(res.status).to.equal(400)
    expect(res.body).to.be.eql({
      error: {
        message: `No agent found with id of '20' in match '${match.id}' in dimension abcdef3 - 'dimension_abcdef3'`,
        status: 400,
      }
    });
  });

  after( async () => {
    await dimension.cleanupMatches();
  });
});

const verifyAgentWithResponse = (match: Match, res: any) => {
  // remove dates because they are stored as strings in api response
  for (let agent of match.agents) {
    delete agent.creationDate
  }
  for (let agent of res.body.agents) {
    delete agent.creationDate
  }
  expect(match.agents).to.containSubset(res.body.agents);
}