import * as Dimension from '../src';
let MatchStatus = Dimension.MatchStatus;
const RockPaperScissorsDesign = require('./rps').RockPaperScissorsDesign;

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mocha';
chai.use(chaiAsPromised);

describe('Tournament Testing with RPS', () => {
  let RPSDesign, myDimension_line_count, RPSDesign_line_count;
  let myDimension: Dimension.DimensionType;
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
    // myDimension.createTournament()
  });

});