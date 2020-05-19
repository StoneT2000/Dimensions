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
      type: Tournament.Type.LADDER,
      agentsPerMatch: [2],
      rankSystem: Tournament.RankSystem.ELO,
      resultHandler: () => {}
    });
    expect(tourney.configs.type).to.be.eql(Tournament.Type.LADDER);
    expect(tourney.configs.rankSystem).to.be.eql(Tournament.RankSystem.ELO);

    tourney = d.createTournament([], {
      type: Tournament.Type.ROUND_ROBIN,
      agentsPerMatch: [2],
      rankSystem: Tournament.RankSystem.WINS,
      resultHandler: () => {}
    });
    expect(tourney.configs.type).to.be.eql(Tournament.Type.ROUND_ROBIN);
    expect(tourney.configs.rankSystem).to.be.eql(Tournament.RankSystem.WINS);

    tourney = d.createTournament([], {
      type: Tournament.Type.ELIMINATION,
      agentsPerMatch: [2],
      rankSystem: Tournament.RankSystem.WINS,
      resultHandler: () => {}
    });
    expect(tourney.configs.type).to.be.eql(Tournament.Type.ELIMINATION);
    expect(tourney.configs.rankSystem).to.be.eql(Tournament.RankSystem.WINS);
  });
  it('shouldn\'t be able to remove non-existent matches', () => {
    let dominationDesign = new DominationDesign('Domination');
    let d = Dimension.create(dominationDesign, {
      activateStation: false,
      observe: false,
      loggingLevel: Logger.LEVEL.NONE
    });
    expect(d.removeMatch('j13k2m')).to.eventually.equal(false);
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
      backingDatabase: "none",
      backingStorage: "none",
      id: "oLBptg",
      defaultMatchConfigs: {
        loggingLevel: Logger.LEVEL.INFO,
        secureMode: false,
      }
    });
  });
});