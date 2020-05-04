import * as Dimension from '../src';
import { DominationDesign } from './domination';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from "sinon-chai";
import 'mocha';
import { Tournament, Logger } from '../src';
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiAsPromised);


describe('Testing Dimension Class', () => {
  it('should initialize a dimension correctly', () => {
    let dominationDesign = new DominationDesign('Domination');
    let d = Dimension.create(dominationDesign, {
      activateStation: false,
      observe: false
    });
    expect(d.name).to.equal(`dimension_${d.id}`);
  });
  it('should initialize tournaments correctly', () => {
    let dominationDesign = new DominationDesign('Domination');
    let d = Dimension.create(dominationDesign, {
      activateStation: false,
      observe: false,
      loggingLevel: Logger.LEVEL.NONE
    });
    let tourney = d.createTournament(['abc', 'def'], {
      type: Tournament.TOURNAMENT_TYPE.LADDER,
      agentsPerMatch: [2],
      rankSystem: Tournament.RANK_SYSTEM.ELO,
      resultHandler: () => {}
    });
    expect(tourney.configs.type).to.be.eql(Tournament.TOURNAMENT_TYPE.LADDER);
    expect(tourney.configs.rankSystem).to.be.eql(Tournament.RANK_SYSTEM.ELO);

    tourney = d.createTournament([], {
      type: Tournament.TOURNAMENT_TYPE.ROUND_ROBIN,
      agentsPerMatch: [2],
      rankSystem: Tournament.RANK_SYSTEM.WINS,
      resultHandler: () => {}
    });
    expect(tourney.configs.type).to.be.eql(Tournament.TOURNAMENT_TYPE.ROUND_ROBIN);
    expect(tourney.configs.rankSystem).to.be.eql(Tournament.RANK_SYSTEM.WINS);

    tourney = d.createTournament([], {
      type: Tournament.TOURNAMENT_TYPE.ELIMINATION,
      agentsPerMatch: [2],
      rankSystem: Tournament.RANK_SYSTEM.WINS,
      resultHandler: () => {}
    });
    expect(tourney.configs.type).to.be.eql(Tournament.TOURNAMENT_TYPE.ELIMINATION);
    expect(tourney.configs.rankSystem).to.be.eql(Tournament.RANK_SYSTEM.WINS);
  });
  it('shouldn\'t be able to remove non-existent matches', () => {
    let dominationDesign = new DominationDesign('Domination');
    let d = Dimension.create(dominationDesign, {
      activateStation: false,
      observe: false,
      loggingLevel: Logger.LEVEL.NONE
    });
    expect(d.removeMatch(123)).to.eventually.equal(false);
  });
  it('should initialize a dimension with default params correctly', () => {
    let dominationDesign = new DominationDesign('Domination');
    let d = Dimension.create(dominationDesign);
    expect(d.configs).to.eql({
      name: '',
      activateStation: true,
      observe: true,
      loggingLevel: Logger.LEVEL.INFO,
      secureMode: false,
      defaultMatchConfigs: {
        dimensionID: d.id,
        loggingLevel: Logger.LEVEL.INFO,
        secureMode: false,
      }
    });
  });
});