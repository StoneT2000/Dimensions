import * as Dimension from '../src';
let MatchStatus = Dimension.Match.Status;
const RockPaperScissorsDesign = require('./rps').RockPaperScissorsDesign;

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { Tournament, Logger, TournamentError } from '../src';
import { DeepPartial } from '../src/utils/DeepPartial';

chai.use(chaiAsPromised);
const expect = chai.expect;

const testTournamentStopResume = async (t: Tournament, done: Function) => {
  let res = t.run();
  
  setTimeout(() => {
    expect(t.resume()).to.eventually.be.rejectedWith(TournamentError);
    expect(t.status).to.equal(Dimension.Tournament.TournamentStatus.RUNNING);
    t.stop();
    
  }, 100);
  const testResume = async () => {
    expect(t.stop()).to.eventually.be.rejectedWith(TournamentError);
    expect(t.status).to.equal(Dimension.Tournament.TournamentStatus.STOPPED);
    await t.resume();
    expect(t.status).to.equal(Dimension.Tournament.TournamentStatus.RUNNING);
    t.destroy();
    done();
  }
  setTimeout(() => {
    testResume();
  }, 1500);

}

describe('Tournament Testing with RPS', () => {
  let RPSDesign, RPSTournament: Dimension.Tournament.RoundRobin.Tournament;
  let DefaultRPSTournament: Dimension.Tournament.RoundRobin.Tournament;
  let myDimension: Dimension.DimensionType;
  
  let players = ['./tests/js-kit/rps/smarter.js', './tests/js-kit/rps/paper.js', './tests/js-kit/rps/errorbot.js', './tests/js-kit/rps/rock.js'];
  let names = ['smarter', 'paper', 'errorplayer', 'rock'];
  let filesAndNames = [];
  for (let i = 0; i < players.length; i++) {
    filesAndNames.push({file: players[i], name: names[i]});
  }
  describe('Round robin', () => {
    before(() => {
      RPSDesign = new RockPaperScissorsDesign('RPS!', {
        engineOptions: {
          timeout: {
            max: 500,
          }
        }
      });
      myDimension = Dimension.create(RPSDesign, {
        name: 'RPS',
        activateStation: false,
        observe: false,
        loggingLevel: Dimension.Logger.LEVEL.WARN
      });
    });
    beforeEach(() => {
      
      DefaultRPSTournament = <Dimension.Tournament.RoundRobin.Tournament>myDimension.createTournament(players, {
        type: Dimension.Tournament.TOURNAMENT_TYPE.ROUND_ROBIN,
        rankSystem: Dimension.Tournament.RANK_SYSTEM.WINS,
        resultHandler: RockPaperScissorsDesign.winsResultHandler,
        agentsPerMatch: [2],
      });
      RPSTournament = <Dimension.Tournament.RoundRobin.Tournament>myDimension.createTournament(filesAndNames, {
        type: Dimension.Tournament.TOURNAMENT_TYPE.ROUND_ROBIN,
        rankSystem: Dimension.Tournament.RANK_SYSTEM.WINS,
        name: 'Rock Paper Scissors',
        loggingLevel: Dimension.Logger.LEVEL.NONE,
        agentsPerMatch: [2],
        consoleDisplay: false,
        defaultMatchConfigs: {
          bestOf: 3,
          loggingLevel: Dimension.Logger.LEVEL.WARN
        },
        resultHandler: RockPaperScissorsDesign.winsResultHandler
      });
      RPSTournament.setConfigs({
        rankSystemConfigs: {
          winValue: 2,
          descending: false,
        }
      })
    });
    describe('Initializing a tournament', () => {
      it('should have correct default parameters', async () => {
        expect(DefaultRPSTournament.name).to.equal(`tournament_${DefaultRPSTournament.id}`);
        expect(DefaultRPSTournament.competitors.length).to.equal(4);
        expect(DefaultRPSTournament.competitors[0].tournamentID.name).to.equal(`player-t${DefaultRPSTournament.id}_0`);
        // should be same as dimension
        expect(DefaultRPSTournament.log.level).to.equal(Logger.LEVEL.WARN);
        expect(DefaultRPSTournament.configs.consoleDisplay).to.equal(true);
      });
      it('should have correct overriden parameters', async () => {
        expect(RPSTournament.name).to.equal('Rock Paper Scissors');
        expect(RPSTournament.competitors.length).to.equal(4);
        expect(RPSTournament.competitors[0].tournamentID.name).to.equal('smarter');
        expect(RPSTournament.log.level).to.equal(Logger.LEVEL.NONE);
      });
    })
    describe('Running Tournament', async () => {
      it('should run a tourney and output appropriate results', async () => {
        let res: Tournament.RoundRobin.State = <Tournament.RoundRobin.State>(await RPSTournament.run());
        let id = RPSTournament.id;
        expect(res.playerStats.get(`t${id}_0`)).to.contain({wins: 6, ties: 0, losses: 0, matchesPlayed: 6});
        expect(res.playerStats.get(`t${id}_1`)).to.contain({wins: 4, ties: 0, losses: 2, matchesPlayed: 6});
        expect(res.playerStats.get(`t${id}_2`)).to.contain({wins: 0, ties: 0, losses: 6, matchesPlayed: 6});
        expect(res.playerStats.get(`t${id}_3`)).to.contain({wins: 2, ties: 0, losses: 4, matchesPlayed: 6});
        let ranks = RPSTournament.getRankings();
        expect(ranks[0]).to.contain({name:'errorplayer', id:`t${id}_2`, score: 0});
        expect(ranks[1]).to.contain({name:'rock', id:`t${id}_3`, score: 4});
        expect(ranks[2]).to.contain({name:'paper', id:`t${id}_1`, score: 8});
        expect(ranks[3]).to.contain({name:'smarter', id:`t${id}_0`, score: 12});
      });
      it('should run be able to stop and resume a tourney and handle errors', (done) => {
        let t = <Dimension.Tournament.RoundRobin.Tournament>myDimension.createTournament(filesAndNames, {
          type: Dimension.Tournament.TOURNAMENT_TYPE.ROUND_ROBIN,
          rankSystem: Dimension.Tournament.RANK_SYSTEM.WINS,
          name: 'Rock Paper Scissors',
          loggingLevel: Dimension.Logger.LEVEL.NONE,
          agentsPerMatch: [2],
          consoleDisplay: false,
          defaultMatchConfigs: {
            bestOf: 3,
            loggingLevel: Dimension.Logger.LEVEL.WARN
          },
          resultHandler: RockPaperScissorsDesign.winsResultHandler
        });
        testTournamentStopResume(t, done);

      });
    });
    it('should be able to validate tournament IDS', () => {
      expect(RPSTournament.validateTournamentID(`t${RPSTournament.id}_1`)).to.equal(true);
      expect(RPSTournament.validateTournamentID(`t${RPSTournament.id}_3`)).to.equal(true);
      expect(RPSTournament.validateTournamentID(`${RPSTournament.id}_1`)).to.equal(false);
      expect(RPSTournament.validateTournamentID(`t${RPSTournament.id + 1}_1`)).to.equal(false);
      expect(RPSTournament.validateTournamentID(`t${RPSTournament.id}9`)).to.equal(false);
      expect(RPSTournament.validateTournamentID(`ls -a; rm -rf;`)).to.equal(false);
      expect(RPSTournament.validateTournamentID(`t${RPSTournament.id}_3;ls -a`)).to.equal(false);
      expect(RPSTournament.validateTournamentID(`t${RPSTournament.id};ls_3`)).to.equal(false);
    });
  });

  describe('Elimination', () => {
    let EliminationTourney: Tournament;
    beforeEach(() => {
      myDimension = Dimension.create(RPSDesign, {
        name: 'RPS',
        activateStation: false,
        observe: false,
        loggingLevel: Dimension.Logger.LEVEL.WARN
      });
      EliminationTourney = myDimension.createTournament(filesAndNames, {
        type: Dimension.Tournament.TOURNAMENT_TYPE.ELIMINATION,
        rankSystem: Dimension.Tournament.RANK_SYSTEM.WINS,
        name: 'Rock Paper Scissors Elim Tourney',
        loggingLevel: Dimension.Logger.LEVEL.NONE,
        agentsPerMatch: [2],
        consoleDisplay: false,
        defaultMatchConfigs: {
          bestOf: 329,
          loggingLevel: Dimension.Logger.LEVEL.WARN
        },
        resultHandler: RockPaperScissorsDesign.winsResultHandler
      });
    });
    describe('Running Tournament', async () => {
      it('should run a tourney and output appropriate results', async () => {
        let res = <Tournament.Elimination.State>(await EliminationTourney.run());
        expect(res.playerStats.get('t0_0').rank).to.equal(1);
      });
      it('should stop and resume', (done) => {
        testTournamentStopResume(EliminationTourney, done);
      });
    });
  });
  describe('Trueskill Ladder', () => {
    let RPSTrueskillLadder: Dimension.Tournament.Ladder.Tournament;
    let RPSTrueskillLadderConfigTests: Dimension.Tournament.Ladder.Tournament;
    let trueskillConfigs: DeepPartial<Tournament.RANK_SYSTEM.TRUESKILL.Configs> = {};
    let defaultMatchConfigsTests = {
      bestOf: 1000,
      loggingLevel: Dimension.Logger.LEVEL.WARN
    }
    before(() => {
      RPSDesign = new RockPaperScissorsDesign('RPS!', {
        engineOptions: {
          timeout: {
            max: 500,
          }
        }
      });
      myDimension = Dimension.create(RPSDesign, {
        name: 'RPS',
        activateStation: false,
        observe: false,
        loggingLevel: Dimension.Logger.LEVEL.WARN
      });
      
      trueskillConfigs.initialMu = 100;
      trueskillConfigs.initialSigma = 15;
      RPSTrueskillLadderConfigTests = <Dimension.Tournament.Ladder.Tournament>myDimension.createTournament(filesAndNames, {
        type: Dimension.Tournament.TOURNAMENT_TYPE.LADDER,
        rankSystem: Dimension.Tournament.RANK_SYSTEM.TRUESKILL,
        rankSystemConfigs: trueskillConfigs,
        name: 'Rock Paper Scissors Trueskill ladder',
        loggingLevel: Dimension.Logger.LEVEL.NONE,
        agentsPerMatch: [2],
        consoleDisplay: false,
        defaultMatchConfigs: defaultMatchConfigsTests,
        resultHandler: RockPaperScissorsDesign.trueskillResultHandler
      });
    });
    beforeEach(() => {
      
      RPSTrueskillLadder = <Dimension.Tournament.Ladder.Tournament>myDimension.createTournament(filesAndNames, {
        type: Dimension.Tournament.TOURNAMENT_TYPE.LADDER,
        rankSystem: Dimension.Tournament.RANK_SYSTEM.TRUESKILL,
        name: 'Rock Paper Scissors Trueskill ladder',
        loggingLevel: Dimension.Logger.LEVEL.NONE,
        agentsPerMatch: [2],
        consoleDisplay: false,
        defaultMatchConfigs: {
          bestOf: 329,
          loggingLevel: Dimension.Logger.LEVEL.WARN
        },
        resultHandler: RockPaperScissorsDesign.trueskillResultHandler
      });
    });
    it('should have changed configs correctly', () => {
      let r = RPSTrueskillLadderConfigTests;
      expect(r.configs.agentsPerMatch).to.be.eql([2]);
      expect(r.configs.rankSystemConfigs).to.be.eql(trueskillConfigs);
      expect(r.configs.defaultMatchConfigs).to.be.eql(defaultMatchConfigsTests);
    });
    it('should run normally', (done) => {
      RPSTrueskillLadder.run();
      setTimeout(() => {
        RPSTrueskillLadder.destroy();
        done();
      }, 2000);
    });
    it('should be able to add/update competitors', () => {
      RPSTrueskillLadder.addplayer('./tests/js-kit/rps/smarter.js');
      expect(RPSTrueskillLadder.competitors.length).to.equal(5);
      expect(RPSTrueskillLadder.competitors[4].file).to.equal('./tests/js-kit/rps/smarter.js');
      expect(RPSTrueskillLadder.competitors[4].tournamentID.id).to.equal(`t${RPSTrueskillLadder.id}_4`);
      RPSTrueskillLadder.addplayer('./test/js-kit/rps/rock.js', `t${RPSTrueskillLadder.id}_0`);
      expect(RPSTrueskillLadder.competitors[0].file).to.equal('./test/js-kit/rps/rock.js');
      RPSTrueskillLadder.addplayer({file:'./test/js-kit/rps/rock.js', name:'newname'}, `t${RPSTrueskillLadder.id}_1`);
      expect(RPSTrueskillLadder.competitors[1].file).to.equal('./test/js-kit/rps/rock.js');
      expect(RPSTrueskillLadder.competitors[1].tournamentID.name).to.equal('newname');
      expect(RPSTrueskillLadder.addplayer({file:'./test/js-kit/rps/rock.js', name:'newname'}, `t_100_22_not_real_id`)).to.be.rejectedWith(TournamentError);
    });
    it('should be able to remove active matches', (done) => {
      RPSTrueskillLadder.run();
      setTimeout(() => {
        let removePromises = [];
        expect(RPSTrueskillLadder.matches.size).to.not.be.equal(0);
        // stop the tournament and remove all matches
        RPSTrueskillLadder.stop();
        RPSTrueskillLadder.matches.forEach((match) => {
          removePromises.push(RPSTrueskillLadder.removeMatch(match.id));
        });
        Promise.all(removePromises).then(() => {
          expect(RPSTrueskillLadder.matches.size).to.be.equal(0);
          done();
        });
      }, 2000);
    });
    it('should stop and resume normally', (done) => {
      testTournamentStopResume(RPSTrueskillLadder, done);
    });
  });
  

});