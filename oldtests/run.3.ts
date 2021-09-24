import * as Dimension from '../src';
let Match = Dimension.Match;
const RockPaperScissorsDesign = require('./rps').RockPaperScissorsDesign;

let paperBot = {
  file: './tests/kits/js/normal/paper.js',
  name: 'paper_ftw_1',
  existingID: 'abcdef',
};
let pybot = { file: './tests/kits/python/bot.py', name: 'pybot' };
let RPSDesign = new RockPaperScissorsDesign('RPS!', {
  engineOptions: {
    timeout: {
      max: 500,
    },
  },
});
let myDimension = Dimension.create(RPSDesign, {
  name: 'RPS',
  loggingLevel: Dimension.Logger.LEVEL.WARN,
  id: 'oLBptg',
});

let botList = [];

// for (let i = 1; i <= 6; i++) {
//   rockBot.name = 'only_rock_' + i;
//   botList.push({...rockBot});
//   randomBot.name = 'pure_random_' + i;
//   botList.push({...randomBot});
// }
botList.push(paperBot);
botList.push(pybot);
botList.push(pybot);
botList.push(pybot);
botList.push(pybot);
botList.push(pybot);
botList.push(pybot);
botList.push(pybot);
// botList.push(smarterBot);

let RPSTournament = <Dimension.Tournament.Ladder>myDimension.createTournament(
  botList,
  {
    type: Dimension.Tournament.Type.LADDER,
    rankSystem: Dimension.Tournament.RankSystemTypes.WINS,
    loggingLevel: Dimension.Logger.LEVEL.ERROR,
    name: 'Best of 329 Rock Paper Scissors Tournamnet',
    consoleDisplay: true,
    defaultMatchConfigs: {
      bestOf: 329,
      loggingLevel: Dimension.Logger.LEVEL.WARN,
    },
    agentsPerMatch: [2],
    tournamentConfigs: {},
    resultHandler: RockPaperScissorsDesign.resultHandler,
    id: 'a0Zlpa',
  }
);

RPSTournament.run().then((r) => {
  // console.log(r);
});
