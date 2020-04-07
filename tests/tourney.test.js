const Dimension = require('../src');
let MatchStatus = Dimension.MatchStatus;
const RockPaperScissorsDesign = require('./rps').RockPaperScissorsDesign;
describe('Rock Paper Scissors Run', () => {
  let RPSDesign, myDimension_line_count, RPSDesign_line_count;
  let myDimension;
  beforeAll(() => {
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
    RPSDesign_line_count = new RockPaperScissorsDesign('RPS!', {
      engineOptions: {
        commandFinishPolicy: 'line_count'
      }
    });
    myDimension_line_count = Dimension.create(RPSDesign_line_count, {
      name: 'RPS_line_count',
      activateStation: false,
      observe: false,
      loggingLevel: Dimension.Logger.LEVEL.WARN
    });
  })

  test('Initializing tournament', async () => {
    
  })

});