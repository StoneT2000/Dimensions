import { MongoDB, GCloudStorage } from '../src';
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

let mongo = new MongoDB('mongodb://localhost:27017/dimensions_rps_test');
let gcloudstorage = new GCloudStorage({
  projectId: 'astute-smile-275203',
  keyFilename: './tests/keys/astute-smile-275203-62b465430241.json',
});
myDimension.use(gcloudstorage).then(async () => {
  myDimension.use(mongo).then(async () => {
    let RPSTournament = <Dimension.Tournament.Ladder>(
      myDimension.createTournament(botList, {
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
        resultHandler: RockPaperScissorsDesign.eloResultHandler,
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
