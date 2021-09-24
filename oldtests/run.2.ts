import * as Dimension from '../src';
let MatchStatus = Dimension.Match.Status;
const RockPaperScissorsDesign = require('./rps').RockPaperScissorsDesign;

let bots = [
  './tests/kits/js/normal/ro.js',
  './tests/kits/js/normal/paper.js',
  './tests/kits/js/normal/paper.js',
];
let RPSDesign = new RockPaperScissorsDesign('RPS!', {
  engineOptions: {
    timeout: {
      max: 100,
    },
  },
});
let myDimension = Dimension.create(RPSDesign, {
  name: 'RPS',
  activateStation: false,
  observe: false,
  secureMode: true,
  loggingLevel: Dimension.Logger.LEVEL.WARN,
});

let RPSTournament = myDimension.createTournament(bots, {
  type: Dimension.Tournament.TOURNAMENT_TYPE.ROUND_ROBIN,
  rankSystem: Dimension.Tournament.RANK_SYSTEM.WINS,
  loggingLevel: Dimension.Logger.LEVEL.INFO,
  defaultMatchConfigs: {
    bestOf: 3,
    loggingLevel: Dimension.Logger.LEVEL.WARN,
  },
  agentsPerMatch: [2],
  tournamentConfigs: {
    times: 100,
  },
  consoleDisplay: false,
  resultHandler: (results: any) => {
    // console.log(results);
    let winners = [];
    let losers = [];
    let ties = [];
    if (results.winner === 'Tie') {
      ties = [0, 1];
    } else {
      winners.push(results.winnerID);
      losers.push((results.winnerID + 1) % 2);
    }
    return { winners: winners, losers: losers, ties: ties };
  },
});

RPSTournament.setConfigs({
  tournamentConfigs: {
    times: 2,
  },
});

// console.log(RPSTournamnet);
RPSTournament.run({ consoleDisplay: true }).then((r) => {
  console.log(r);
});
