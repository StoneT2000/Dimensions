import * as Dimension from '../src';
let Match = Dimension.Match;
const RockPaperScissorsDesign = require('./rps').RockPaperScissorsDesign;

let rockBot = { file: './tests/js-kit/rps/rock.js', name: 'only_rock' };
let paperBot = { file: './tests/js-kit/rps/paper.js', name: 'paper_ftw_1' };
let randomBot = { file: './tests/js-kit/rps/random.js', name: 'random' };
let smarterBot = { file: './tests/js-kit/rps/smarter.js', name: 'smarter' };
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
});

let botList = [];

for (let i = 1; i <= 12; i++) {
  rockBot.name = 'only_rock_' + i;
  botList.push({ ...rockBot });
  // randomBot.name = 'pure_random_' + i;
  // botList.push({...randomBot});
}
botList.push(paperBot);
// botList.push(smarterBot);

let RPSTournament = <Dimension.Tournament.Ladder>myDimension.createTournament(
  botList,
  {
    type: Dimension.Tournament.TOURNAMENT_TYPE.ELIMINATION,
    rankSystem: Dimension.Tournament.RANK_SYSTEM.WINS,
    loggingLevel: Dimension.Logger.LEVEL.DETAIL,
    name: 'Best of 329 Rock Paper Scissors Elimination Tournamnet',
    consoleDisplay: true,
    defaultMatchConfigs: {
      bestOf: 329,
      loggingLevel: Dimension.Logger.LEVEL.NONE,
    },
    agentsPerMatch: [2],
    tournamentConfigs: {
      seeding: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    },
    resultHandler: RockPaperScissorsDesign.resultHandler,
  }
);

// RPSTournament.setConfigs({
//   tournamentConfigs: {
//     maxConcurrentMatches: 5,
//   }
// });

RPSTournament.run().then((r) => {
  console.log(RPSTournament.getRankings(0, -1));
});

// setTimeout(() => {
//   RPSTournament.stop();
// }, 2000);
