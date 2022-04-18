import { GCloudDataStore } from '../src';
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
  secureMode: true,
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

const paperBot = {
  file: './tests/kits/js/normal/paper.js',
  name: 'paperbot',
  existingID: 'paperbot',
};
const botList = [rock, paper];
const userBotList = [disabled, users.rock1, users.rock2, paperBot];

let datastore = new GCloudDataStore({
  keyFile: './tests/keys/owneraccess.json',
});
myDimension.use(datastore).then(async () => {
  // let q = datastore.datastore.createQuery(GCloudDataStore.Kinds.USERS).filter("statistics.test.nested", "=", "abc");

  // console.log((await datastore.datastore.runQuery(q)))
  // console.log(await myDimension.databasePlugin.getUser('J3esSgHpBEJJ'));
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
      tournamentConfigs: {},
      resultHandler: RockPaperScissorsDesign.eloResultHandler,
      id: 'a0Zlpa',
    }
  );
  console.log(
    await datastore.getUsersInTournament(RPSTournament.getKeyName(), 0, -1)
  );
});
