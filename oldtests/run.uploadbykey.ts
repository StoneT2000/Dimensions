import * as Dimension from '../src';
import { FileSystemStorage } from '../src/SupportedPlugins/FileSystemStorage';
import { MongoDB, GCloudDataStore } from '../src';
let Match = Dimension.Match;
const RockPaperScissorsDesign = require('./rps').RockPaperScissorsDesign;

let paperBot = {
  file: './tests/kits/js/normal/paper.js',
  name: 'paper_ftw_1',
  existingID: 'abcdef',
};
const users = {
  // in seed, rock1 has stats in tourneys already
  rock1: {
    file: './tests/kits/js/normal/rock.js',
    name: 'rock1',
    existingID: 'rock1',
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
let pybot = { file: './tests/kits/python/bot.py', name: 'pybot' };
let RPSDesign = new RockPaperScissorsDesign('RPS!', {
  engineOptions: {
    timeout: {
      max: 500,
    },
  },
});
let myDimension = Dimension.create(RPSDesign, {
  name: 'uploadtest',
  loggingLevel: Dimension.Logger.LEVEL.WARN,
  id: 'oLBptg',
});

const mongo = new MongoDB(
  'mongodb://root:rootpassword@localhost:27017/test?authSource=admin&readPreference=primary'
);
// const datastore = new GCloudDataStore({
//   keyFile: './tests/keys/dimensions-ai-testing-bfe3a687aea0.json',
// });
const fsstore = new FileSystemStorage();
const run = async () => {
  await myDimension.use(mongo);
  await myDimension.use(fsstore);
  let RPSTournament = <Dimension.Tournament.Ladder>myDimension.createTournament(
    [],
    {
      type: Dimension.Tournament.Type.LADDER,
      rankSystem: Dimension.Tournament.RankSystemTypes.TRUESKILL,
      loggingLevel: Dimension.Logger.LEVEL.ERROR,
      name: 'Best of 329 Rock Paper Scissors Tournament',
      consoleDisplay: false,
      defaultMatchConfigs: {
        bestOf: 329,
        loggingLevel: Dimension.Logger.LEVEL.WARN,
      },
      agentsPerMatch: [2],
      tournamentConfigs: {},
      resultHandler: RockPaperScissorsDesign.eloResultHandler,
      id: 'a0Zlpa',
    }
  );
};

run();
