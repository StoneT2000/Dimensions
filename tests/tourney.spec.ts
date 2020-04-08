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
    RPSTournament = <Dimension.Tournament.RoundRobinTournament>myDimension.createTournament(filesAndNames, {
      type: Dimension.Tournament.TOURNAMENT_TYPE.ROUND_ROBIN,
      rankSystem: Dimension.Tournament.RANK_SYSTEM.WINS,
      name: 'Rock Paper Scissors',
      defaultMatchConfigs: {
        bestOf: 3,
        loggingLevel: Dimension.Logger.LEVEL.WARN
      },
      resultHandler: (results: any) => {
        // console.log(results);
        let winners = [];
        let losers =[];
        let ties = [];
        if (results.winner === 'Tie') {
          ties = [0, 1];
        }
        else {
          winners.push(results.winnerID);
          losers.push((results.winnerID + 1) % 2);
        }
        return {winners: winners, losers: losers, ties: ties};
      }
    });
    RPSTournament.setConfigs({
      rankSystemConfigs: {
        winValue: 2,
        ascending: false
      }
    })
  })

  it('Initializing tournament', async () => {
    expect(RPSTournament.name).to.equal('Rock Paper Scissors');
    expect(RPSTournament.competitors.length).to.equal(4);
    expect(RPSTournament.competitors[0].tournamentID.name).to.equal('smarter');
    expect(RPSTournament.log.level).to.equal(LoggerLEVEL.INFO);
  });
  it('Run Tourney', async () => {
    let res: Tournament.RoundRobinState = <Tournament.RoundRobinState>(await RPSTournament.run());
    expect(res.botStats.get('t0_0')).to.contain({wins: 3, ties: 0, losses: 0, matchesPlayed: 3});
    expect(res.botStats.get('t0_1')).to.contain({wins: 2, ties: 0, losses: 1, matchesPlayed: 3});
    expect(res.botStats.get('t0_2')).to.contain({wins: 0, ties: 0, losses: 3, matchesPlayed: 3});
    expect(res.botStats.get('t0_3')).to.contain({wins: 1, ties: 0, losses: 2, matchesPlayed: 3});
    let ranks = RPSTournament.getRankings();
    expect(ranks[0]).to.contain({name:'errorbot', id:'t0_2', score: 0});
    expect(ranks[1]).to.contain({name:'rock', id:'t0_3', score: 2});
    expect(ranks[2]).to.contain({name:'paper', id:'t0_1', score: 4});
    expect(ranks[3]).to.contain({name:'smarter', id:'t0_0', score: 6});

  })

});