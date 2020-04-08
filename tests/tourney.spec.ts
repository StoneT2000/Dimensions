import * as Dimension from '../src';
let MatchStatus = Dimension.MatchStatus;
const RockPaperScissorsDesign = require('./rps').RockPaperScissorsDesign;

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mocha';
chai.use(chaiAsPromised);
const expect = chai.expect;

describe('Tournament Testing with RPS', () => {
  let RPSDesign, RPSTournament: Dimension.Tournament.TournamentClasses;
  let myDimension: Dimension.DimensionType;
  let bots = ['./tests/js-kit/rps/smarter.js', './tests/js-kit/rps/paper.js', './tests/js-kit/rps/errorBot.js']
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
    RPSTournament = myDimension.createTournament(bots, {
      type: Dimension.Tournament.TOURNAMENT_TYPE.ROUND_ROBIN,
      rankSystem: Dimension.Tournament.RANK_SYSTEM.WINS,
      loggingLevel: Dimension.Logger.LEVEL.INFO,
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
  })

  it('Initializing tournament', async () => {
    expect(RPSTournament.competitors.length).to.equal(3);
  });
  it('Run Tourney', async () => {
    let res = await RPSTournament.run();
    console.log(res);
  })

});