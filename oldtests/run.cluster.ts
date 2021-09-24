import { MongoDB } from '../src';
import { Match } from '../src/Match';
import * as Dimension from '../src';

import cluster from 'cluster';

const numCPUs = require('os').cpus().length;
const FORK_COUNT = 1;
// this works! now because we have a database to centralize and distribute our data
if (cluster.isMaster) {
  for (let i = 0; i < FORK_COUNT; i++) {
    cluster.fork();
  }
}

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
let rockBot = { file: './tests/js-kit/rps/rock.js', name: 'only_rock' };
let paperBot = {
  file: './tests/js-kit/rps/paper.js',
  name: 'paper_ftw_1',
  existingID: 'X8Vq2rYTXUBK',
};
let randomBot = { file: './tests/js-kit/rps/random.js', name: 'random' };
let brokenBot = { file: './tests/js-kit/rps/broken.js', name: 'broken' };
let smarterBot = {
  file: './tests/js-kit/rps/smarter.js',
  name: 'smarter',
  existingID: 'm4ZecDhntLFW',
};

let botList: any = [paperBot, smarterBot, brokenBot];

let mongo = new MongoDB('mongodb://localhost:27017/dimensions_rps_test');
myDimension.use(mongo).then(async () => {
  // for (let i = 1; i <= 2; i++) {
  //   rockBot.name = 'only_rock_' + i;
  //   botList.push({...rockBot});
  //   randomBot.name = 'pure_random_' + i;
  //   botList.push({...randomBot});
  //   // mongo.registerUser(rockBot.name, 'test');
  //   // mongo.registerUser(randomBot.name, 'test');

  // }
  // mongo.registerUser('smarter', 'test');
  // mongo.registerUser('paper_ftw_1', 'test');
  let RPSTournament = <Dimension.Tournament.Ladder>myDimension.createTournament(
    botList,
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
      tournamentConfigs: {},
      resultHandler: RockPaperScissorsDesign.eloResultHandler,
      id: 'a0Zlpa',
    }
  );

  // console.log(doc);
  // let user = await mongo.loginUser('test', 'abc3');

  // console.log(user);
  // let deleted = await mongo.deleteUser('test');
  // RPSTournament.run().then((r) => {
  //   console.log(r);
  // });
});
