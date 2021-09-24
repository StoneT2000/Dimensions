import { MongoDB, FireStore } from '../src';
import { Match } from '../src/Match';
import * as Dimension from '../src';
import { fork } from 'child_process';

const RockPaperScissorsDesign = require('./rps').RockPaperScissorsDesign;
let RPSDesign = new RockPaperScissorsDesign('RPS!', {
  engineOptions: {
    timeout: {
      max: 2000,
    },
  },
});
let myDimension = Dimension.create(RPSDesign, {
  name: 'RPS',
  activateStation: true,
  observe: true,
  loggingLevel: Dimension.Logger.LEVEL.INFO,
  secureMode: false,
  id: 'oLBptg',
});
const paper = { file: './tests/kits/js/normal/paper.js', name: 'paper' };
const rock = { file: './tests/kits/js/normal/rock.js', name: 'rock' };
const disabled = {
  file: './tests/kits/js/normal/rock.js',
  name: 'disabled',
  existingID: 'disabled',
};

const users = {
  rock1: {
    file: './tests/kits/js/normal/rock.js',
    name: 'rock1',
    existingID: 'rock12',
  },
  rock2: {
    file: './tests/kits/js/normal/rock.js',
    name: 'rock2',
    existingID: 'rock2',
  },
  rock3: {
    file: './tests/kits/js/normal/rock.js',
    name: 'rock3',
    existingID: 'rock3',
  },
};

const paperBot = {
  file: './tests/kits/js/normal/paper.js',
  name: 'paperbot',
  existingID: 'paperbot',
};
const botList = [rock, paper];
const userBotList = [disabled, users.rock1, users.rock2, paperBot];

// let mongo = new MongoDB(
//   'mongodb://root:rootpassword@localhost:27017/test?authSource=admin&readPreference=primary'
// );
let mongo = new MongoDB(
  'mongodb+srv://admin:0jMQD0SXxUsDYOCt@acmai-competitions.bogno.mongodb.net/energium?retryWrites=true&w=majority'
);
// let firestore = new FireStore({
//   keyFile: './tests/keys/firestore.json',
// });
myDimension.use(mongo).then(async () => {
  let RPSTournament = <Dimension.Tournament.Ladder>myDimension.createTournament(
    userBotList,
    {
      type: Dimension.Tournament.Type.LADDER,
      rankSystem: Dimension.Tournament.RankSystemTypes.TRUESKILL,
      loggingLevel: Dimension.Logger.LEVEL.INFO,
      name: 'Another RPS',
      consoleDisplay: false,
      defaultMatchConfigs: {
        bestOf: 11,
        loggingLevel: Dimension.Logger.LEVEL.INFO,
      },
      agentsPerMatch: [2],
      tournamentConfigs: {
        syncConfigs: false,
      },
      resultHandler: RockPaperScissorsDesign.resultHandler,
      id: 'a0Zlpa',
    }
  );
  // RPSTournament.run();
});
