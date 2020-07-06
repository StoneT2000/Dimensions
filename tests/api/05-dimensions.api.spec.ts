import * as Dimension from '../../src';
import chai from 'chai';
import chaiHttp from 'chai-http'
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from "sinon-chai";
import 'mocha';
import { Logger, Match, MongoDB } from '../../src';
import { RockPaperScissorsDesign } from '../rps';
import MatchSchemaCreator from '../../src/SupportedPlugins/MongoDB/models/match';
chai.should()
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiSubset)
chai.use(chaiAsPromised);
chai.use(chaiHttp)

describe('Testing /api/dimensions/:dimensionID/user API', () => {
  const base = '/api/dimensions/:dimensionID/user';
  let origin = "http://localhost:"
  let endpoint = '';
  let d: Dimension.DimensionType;
  let match: Dimension.Match;
  let botList = ['./tests/kits/js/normal/rock.js', './tests/kits/js/normal/paper.js']
  let mongo = new MongoDB('mongodb://root:rootpassword@localhost:27017/test?authSource=admin&readPreference=primary');
  before( async () => {
    let rpsDesign = new RockPaperScissorsDesign('RPS');
    d = Dimension.create(rpsDesign, {
      activateStation: true,
      observe: true,
      loggingLevel: Logger.LEVEL.NONE,
      id: "abcdef3",
      defaultMatchConfigs: {
        storeErrorLogs: false
      }
    });
    origin += d.getStation().port
    endpoint = origin + `/api/dimensions/${d.id}/user`
    await d.use(mongo);
  });

  it(`GET ${base}/:userID - should return user with id userID`, async () => {
    const res = await chai.request(endpoint)
    .get(`/rock1`);
    expect(res.status).to.equal(200)
    expect(res.body.user).to.containSubset({
      "playerID": "rock1",
      "username": "rock1",
    });
  });

  it(`GET ${base}/:userID - should return 200 and null user, if user with id userID does not exist`, async () => {
    const res = await chai.request(endpoint)
    .get(`/12345fakerandomid`);
    expect(res.status).to.equal(200)
    expect(res.body).to.be.eql({
      error: null,
      user: null
    });
  });
  after(() => {
    d.cleanup();
    mongo.db.close();
  });
});