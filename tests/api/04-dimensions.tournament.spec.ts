import * as Dimension from '../../src';
import chai, { expect } from 'chai';
import chaiHttp from 'chai-http'
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from "sinon-chai";
import 'mocha';
import { Logger } from '../../src';
import { RockPaperScissorsDesign } from '../rps';
import { Ladder } from '../../src/Tournament/Ladder';
import { createLadderTourney } from '../core/tourney/utils';
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
  let t: Ladder;
  const paper = './tests/kits/js/normal/paper.js';
  const rock = './tests/kits/js/normal/rock.js'
  const botList = [rock, paper];
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
    t = createLadderTourney(dimension, botList, {
      id: 'tournamentid'
    });
  });
  it(`GET ${base}/tournament - should return all tournaments`, async () => {
    let res = await chai.request(endpoint)
    .get(`/tournament`)
    expect(res.status).to.equal(200);
    expect({
      error: null,
      tournaments: {
        tournamentid: t
      }
    }).to.containSubset(res.body)
  });

  it(`GET ${base}/tournament/:tournamentID - should return tournament with id tournamentID`, async () => {
    let res = await chai.request(endpoint)
    .get(`/tournament/${t.id}`)
    expect(res.status).to.equal(200);
    expect({
      error: null,
      tournament: t
    }).to.containSubset(res.body)
  });

  it(`GET ${base}/tournament/:tournamentID - should return 400, if tournament with id tournamentID does not exist`, async () => {
    let res = await chai.request(endpoint)
    .get(`/tournament/faketournamentID`)
    expect(res.status).to.equal(400);
    expect(res.body).to.eql({
      error: {
        status: 400,
        message: `No tournament found with name or id of 'faketournamentID' in dimension ${dimension.id} - '${dimension.name}'`
      }
    });
  });
});