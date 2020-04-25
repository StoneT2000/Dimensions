import * as Dimension from '../src';
let MatchStatus = Dimension.Match.Status;
const RockPaperScissorsDesign = require('./rps').RockPaperScissorsDesign;

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { Tournament, Logger } from '../src';
chai.use(chaiAsPromised);
const expect = chai.expect;

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
    DefaultRPSTournament = <Dimension.Tournament.RoundRobin.Tournament>myDimension.createTournament(players, {
      type: Dimension.Tournament.TOURNAMENT_TYPE.ROUND_ROBIN,
      rankSystem: Dimension.Tournament.RANK_SYSTEM.WINS,
      resultHandler: RockPaperScissorsDesign.winsResultHandler,
      agentsPerMatch: [2],
      consoleDisplay: false
    });
    RPSTournament = <Dimension.Tournament.RoundRobin.Tournament>myDimension.createTournament(filesAndNames, {
      type: Dimension.Tournament.TOURNAMENT_TYPE.ROUND_ROBIN,
      rankSystem: Dimension.Tournament.RANK_SYSTEM.WINS,
      name: 'Rock Paper Scissors',
      loggingLevel: Dimension.Logger.LEVEL.ERROR,
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
  })

  describe('Initializing a tournament', () => {
    it('should have correct default parameters', async () => {
      expect(DefaultRPSTournament.name).to.equal('tournament_0');
      expect(DefaultRPSTournament.competitors.length).to.equal(4);
      expect(DefaultRPSTournament.competitors[0].tournamentID.name).to.equal('player-t0_0');
      // should be same as dimension
      expect(DefaultRPSTournament.log.level).to.equal(Logger.LEVEL.WARN);
    });
    it('should have correct overriden parameters', async () => {
      expect(RPSTournament.name).to.equal('Rock Paper Scissors');
      expect(RPSTournament.competitors.length).to.equal(4);
      expect(RPSTournament.competitors[0].tournamentID.name).to.equal('smarter');
      expect(RPSTournament.log.level).to.equal(Logger.LEVEL.ERROR);
    });
  })
  describe('Running Tournament', async() => {
    it('should run a tourney and output appropriate results', async () => {
      let res: Tournament.RoundRobin.State = <Tournament.RoundRobin.State>(await RPSTournament.run());
      expect(res.playerStats.get('t1_0')).to.contain({wins: 6, ties: 0, losses: 0, matchesPlayed: 6});
      expect(res.playerStats.get('t1_1')).to.contain({wins: 4, ties: 0, losses: 2, matchesPlayed: 6});
      expect(res.playerStats.get('t1_2')).to.contain({wins: 0, ties: 0, losses: 6, matchesPlayed: 6});
      expect(res.playerStats.get('t1_3')).to.contain({wins: 2, ties: 0, losses: 4, matchesPlayed: 6});
      let ranks = RPSTournament.getRankings();
      expect(ranks[0]).to.contain({name:'errorplayer', id:'t1_2', score: 0});
      expect(ranks[1]).to.contain({name:'rock', id:'t1_3', score: 4});
      expect(ranks[2]).to.contain({name:'paper', id:'t1_1', score: 8});
      expect(ranks[3]).to.contain({name:'smarter', id:'t1_0', score: 12});
    });
    it('should run be able to stop and resume a tourney', async () => {
  
    });
  })
  

});