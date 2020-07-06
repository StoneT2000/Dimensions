import * as Dimension from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from "sinon-chai";
import 'mocha';
import { Tournament, Logger } from '../../../src';
const expect = chai.expect;
chai.should()
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset)


describe('Testing Dimension Class', () => {
  let ddefault: Dimension.DimensionType;
  let d: Dimension.DimensionType;
  let botList = ['./tests/kits/js/normal/rock.js', './tests/kits/js/normal/paper.js']
  before( async () => {
    let rpsDesign = new RockPaperScissorsDesign('RPS');
    ddefault = Dimension.create(rpsDesign, {
      activateStation: false,
      observe: false,
    });
    d = Dimension.create(rpsDesign, {
      activateStation: false,
      observe: false,
      id: "123456",
      loggingLevel: Logger.LEVEL.NONE,
      defaultMatchConfigs: {
        storeErrorLogs: false
      }
    });
  });
  it('should initialize a dimension with default params correctly', () => {
    expect(ddefault.configs).to.eql({
      name: '',
      activateStation: false,
      observe: false,
      loggingLevel: Logger.LEVEL.INFO,
      secureMode: false,
      backingDatabase: "none",
      backingStorage: "none",
      id: 'oLBptg',
      defaultMatchConfigs: {
        loggingLevel: Logger.LEVEL.INFO,
        secureMode: false,
      },
      stationConfigs: {
        loggingLevel: Logger.LEVEL.INFO
      }
    });
  });
  it('should initialize tournaments correctly', () => {
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

  it('should be able to create matches and with matching configs', async () => {
    let match = await d.createMatch(botList)
    // configs should be superset of  dimension's match config defaults
    expect(match.configs).to.containSubset(d.configs.defaultMatchConfigs)
  });

  it('should be able to remove matches in any state', async () => {
    let match = await d.createMatch(botList)
    expect(d.removeMatch(match.id)).to.eventually.equal(true)
  });
  it('should not be able to remove non-existent matches', () => {
    expect(d.removeMatch('j13k2m')).to.eventually.equal(false);
  });
  
  after(() => {
    ddefault.cleanupMatches();
    ddefault.cleanupTournaments();
    d.cleanupMatches();
    d.cleanupTournaments();
  });
});