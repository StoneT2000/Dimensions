import * as Dimension from '../../src';
import chai from 'chai';
import chaiHttp from 'chai-http'
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from "sinon-chai";
import 'mocha';
import { Station, Logger } from '../../src';
import { NanoID } from '../../src/Dimension';
import { RockPaperScissorsDesign } from '../rps';
// const RockPaperScissorsDesign = require('./rps').RockPaperScissorsDesign;
let should = chai.should();
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset)
chai.use(chaiHttp)

describe('Testing /api/dimensions API', () => {
  let origin = "http://localhost:"
  let dimension: Dimension.DimensionType, dimension2: Dimension.DimensionType
  before(() => {
    let rpsDesign = new RockPaperScissorsDesign('RPS');
    dimension = Dimension.create(rpsDesign, {
      activateStation: true,
      observe: true,
      loggingLevel: Logger.LEVEL.NONE,
      id: "abcdef"
    });
    dimension2 = Dimension.create(rpsDesign, {
      activateStation: true,
      observe: true,
      loggingLevel: Logger.LEVEL.NONE,
      id: "abcdef2"
    });
    origin += dimension.getStation().port
  });
  it("GET /api/dimensions should retrieve all dimensions", (done) => {
    chai.request(origin + "/api/dimensions")
      .get("/")
      .end((err, res) => {
        res.should.have.status(200);
        // res.body.should.containSubset(dimension)
        expect({
          "abcdef": dimension,
          "abcdef2": dimension2
      }).to.be.containSubset(res.body.dimensions)
        done();
      });
    // expect(true).to.equal(true)
  });

  it("GET /api/dimensions/:dimensionID - should retrieve dimension with dimensionID", (done) => {
    chai.request(origin + "/api/dimensions")
      .get(`/${dimension.id}`)
      .end((err, res) => {
        res.should.have.status(200);
        // res.body.should.containSubset(dimension)
        expect(dimension).to.be.containSubset(res.body.dimension)
        done();
      });
  });

  it("GET /api/dimensions/:dimensionID - should return 400, no dimension found, if fake id provided", (done) => {
    chai.request(origin + "/api/dimensions")
      .get(`/notarealid`)
      .end((err, res) => {
        res.should.have.status(400);
        expect(res.body).to.be.eql({
          error: {
            message: "No Dimension found",
            status: 400,
          }
        });
        done();
      });
  });
  
  after(() => {
    dimension.getStation().stop();
  });
});