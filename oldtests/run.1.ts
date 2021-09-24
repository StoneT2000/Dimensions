// docker run --rm --name test -it -d -v /var/run/docker.sock:/var/run/docker.sock stonezt2000/dimensions_langs
//

import * as Dimension from '../src';
import { Logger } from '../src';

import { RockPaperScissorsDesign } from './rps';

let rpsDesign = new RockPaperScissorsDesign('RPS', {
  engineOptions: {
    memory: {
      active: true,
      limit: 1024 * 1024 * 400,
    },
    timeout: {
      active: true,
      max: 2000,
    },
  },
});
//@ts-ignore
let myDimension = Dimension.create(rpsDesign, {
  name: 'RPS',
  loggingLevel: Dimension.Logger.LEVEL.NONE,
  secureMode: false,
  activateStation: false,
  observe: false,
  id: 'oLBptg',
});
let jsSource = './tests/kits/js/normal/rockdelayed.js';
let exceedMemory = './tests/kits/js/normal/rock.exceedmemory.js';
let ts = './tests/kits/ts/bot.ts';
let java = './tests/kits/java/Bot.java';
let py = './tests/kits/python/bot.py';

// setTimeout(() => {
// myDimension
//   .runMatch([ts, ts], {
//     name: 'test-rps-match',
//     bestOf: 99,
//     loggingLevel: Dimension.Logger.LEVEL.ALL,
//     storeErrorLogs: true,
//     agentOptions: {
//       maxInstallTime: 10000,
//       maxCompileTime: 10000,
//     },
//     engineOptions: {
//       noStdErr: false,
//     },
//   })
//   .then((res) => {
//     console.log(res);
//   })
//   .catch((err) => {
//     console.error('Error', err);
//   });
// }, 1000)

async function main() {
  const match = await myDimension.createMatch([py, py], {
    name: 'test',
    storeErrorLogs: false,
    loggingLevel: Logger.LEVEL.WARN,
    engineOptions: {
      noStdErr: false,
    },
    bestOf: 9,
    // secureMode: false,
  });
  const res = await match.run();
  console.log({ res });
}
main();
