import * as Dimension from '../src';
let MatchStatus = Dimension.MatchStatus;
const RockPaperScissorsDesign = require('./rps').RockPaperScissorsDesign;

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { Tournament, LoggerLEVEL } from '../src';
chai.use(chaiAsPromised);
const expect = chai.expect;

describe('Tournament Testing with RPS', () => {
  let RPSDesign, RPSTournament: Dimension.Tournament.RoundRobinTournament;
  let DefaultRPSTournament: Dimension.Tournament.RoundRobinTournament;
  let myDimension: Dimension.DimensionType;
  let bots = ['./tests/js-kit/rps/smarter.js', './tests/js-kit/rps/paper.js', './tests/js-kit/rps/errorBot.js', './tests/js-kit/rps/rock.js'];
  let names = ['smarter', 'paper', 'errorbot', 'rock'];
  let filesAndNames = [];
  for (let i = 0; i < bots.length; i++) {
    filesAndNames.push({file: bots[i], name: names[i]});
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
    DefaultRPSTournament = <Dimension.Tournament.RoundRobinTournament>myDimension.createTournament(bots, {
      type: Dimension.Tournament.TOURNAMENT_TYPE.ROUND_ROBIN,
      rankSystem: Dimension.Tournament.RANK_SYSTEM.WINS,
      resultHandler: RockPaperScissorsDesign.resultHandler
    });
    RPSTournament = <Dimension.Tournament.RoundRobinTournament>myDimension.createTournament(filesAndNames, {
      type: Dimension.Tournament.TOURNAMENT_TYPE.ROUND_ROBIN,
      rankSystem: Dimension.Tournament.RANK_SYSTEM.WINS,
      name: 'Rock Paper Scissors',
      loggingLevel: Dimension.Logger.LEVEL.WARN,
      defaultMatchConfigs: {
        bestOf: 3,
        loggingLevel: Dimension.Logger.LEVEL.WARN
      },
      resultHandler: RockPaperScissorsDesign.resultHandler
    });
    RPSTournament.setConfigs({
      rankSystemConfigs: {
        winValue: 2,
        ascending: false
      }
    })
  })

  describe('Initializing a tournament', () => {
    it('should have correct default parameters', async () => {
      expect(DefaultRPSTournament.name).to.equal('tournament_0');
      expect(DefaultRPSTournament.competitors.length).to.equal(4);
      expect(DefaultRPSTournament.competitors[0].tournamentID.name).to.equal('bot-t0_0');
      expect(DefaultRPSTournament.log.level).to.equal(LoggerLEVEL.INFO);
    });
    it('should have correct overriden parameters', async () => {
      expect(RPSTournament.name).to.equal('Rock Paper Scissors');
      expect(RPSTournament.competitors.length).to.equal(4);
      expect(RPSTournament.competitors[0].tournamentID.name).to.equal('smarter');
      expect(RPSTournament.log.level).to.equal(LoggerLEVEL.WARN);
    });
  })
  describe('Running Tournament', async() => {
    it('should run a tourney and output appropriate results', async () => {
      let res: Tournament.RoundRobinState = <Tournament.RoundRobinState>(await RPSTournament.run());
      expect(res.botStats.get('t1_0')).to.contain({wins: 3, ties: 0, losses: 0, matchesPlayed: 3});
      expect(res.botStats.get('t1_1')).to.contain({wins: 2, ties: 0, losses: 1, matchesPlayed: 3});
      expect(res.botStats.get('t1_2')).to.contain({wins: 0, ties: 0, losses: 3, matchesPlayed: 3});
      expect(res.botStats.get('t1_3')).to.contain({wins: 1, ties: 0, losses: 2, matchesPlayed: 3});
      let ranks = RPSTournament.getRankings();
      expect(ranks[0]).to.contain({name:'errorbot', id:'t1_2', score: 0});
      expect(ranks[1]).to.contain({name:'rock', id:'t1_3', score: 2});
      expect(ranks[2]).to.contain({name:'paper', id:'t1_1', score: 4});
      expect(ranks[3]).to.contain({name:'smarter', id:'t1_0', score: 6});
    });
    it('should run be able to stop and resume a tourney', async () => {
  
    });
  })
  

});