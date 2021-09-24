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
let tsbot = { file: './tests/kits/ts/bot.ts', name: 'tsbot' };
let botList: any = [paperBot, tsbot];

let mongo = new MongoDB('mongodb://localhost:27017/dimensions_rps_test');
let gcloudstorage = new GCloudStorage({
  projectId: 'astute-smile-275203',
  keyFilename: './tests/keys/astute-smile-275203-62b465430241.json',
});
myDimension.use(gcloudstorage).then(async () => {
  myDimension
    .use(mongo)
    .then(async () => {
      let match = await myDimension.createMatch(botList);
      let res = await match.run();
      console.log(match.agents);
    })
    .catch((err) => {
      console.error(err);
    });
});
