import * as Dimension from '../src';
let MatchStatus = Dimension.MatchStatus;
const RockPaperScissorsDesign = require('./rps').RockPaperScissorsDesign;

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mocha';
chai.use(chaiAsPromised);
const expect = chai.expect;

describe('Tournament Testing with RPS', () => {
  let RPSDesign, myDimension_line_count, RPSDesign_line_count;
  let myDimension: Dimension.DimensionType;
  let bots = ['./tests/js-kit/rps/rock.js', './tests/js-kit/rps/paper.js', './tests/js-kit/rps/rock.js']
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
  })

  it('Initializing tournament', async () => {
    myDimension.createTournament(bots, {
      type: Dimension.Tournament.TOURNAMENT_TYPE.ROUND_ROBIN,
      rankSystem: Dimension.Tournament.RANK_SYSTEM.WINS,
      resultHandler: (results: any) => {
        let winners = [];
        let losers =[];
        let ties = [];
        if (results.winner === 'Tie') {
          ties = [0, 1];
        }
        else {
          winners.push(results.winningID);
          losers.push((results.winningID + 1) % 2);
        }
        return {winners: winners, losers: losers, ties: ties};
      }
    });
    expect(myDimension.design).to.eql(RPSDesign);
  });

});