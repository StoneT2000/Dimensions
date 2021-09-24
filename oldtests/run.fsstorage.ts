import { MongoDB, Logger } from '../src';
import { FileSystemStorage } from '../src/SupportedPlugins/FileSystemStorage';
import { Match } from '../src/Match';
import * as Dimension from '../src';

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
  secureMode: true,
  id: 'oLBptg',
});
let rockBot = { file: './tests/kits/js/normal/rock.js', name: 'only_rock' };
let paperBot = {
  file: './tests/kits/js/normal/paper.js',
  name: 'paper_ftw_1',
  existingID: 'X8Vq2rYTXUBK',
};
let stderrBot = {
  file: './tests/kits/js/normal/rock.withstderr.js',
  name: 'stderr',
};

let botList: any = [paperBot, stderrBot];
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
let mongo = new MongoDB(
  'mongodb://root:rootpassword@localhost:27017/test?authSource=admin&readPreference=primary'
);
let fsstorage = new FileSystemStorage({
  // loggingLevel: Logger.LEVEL.SYSTEM,
  maxCacheSize: 1024 * 1024,
});
myDimension.use(fsstorage).then(async () => {
  myDimension.use(mongo).then(async () => {
    let RPSTournament = <Dimension.Tournament.Ladder>(
      myDimension.createTournament([], {
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
      })
    );

    // RPSTournament.setConfigs({
    //   tournamentConfigs: {
    //     maxConcurrentMatches: 1,
    //     maxTotalMatches: 4,

    //   }
    // });
    // RPSTournament.run();
  });
});
