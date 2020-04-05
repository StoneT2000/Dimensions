//nodemon --watch 'tests/**/*.ts' --watch 'src/**/*.ts' --ignore 'src/**/*.spec.ts' --exec 'ts-node' tests/server.ts 

import * as Dimension from '../src/';
// const { DominationDesign } = require('./domination');
import Halite3Design from '@dimensions-ai/designs-halite3';

let halite3Design = new Halite3Design('Domination', {commandDelimiter: ' '});
//@ts-ignore
let haliteLeague = Dimension.create(halite3Design, 
  {name: 'Halite League with All logs', loggingLevel: Dimension.Logger.LEVEL.ALL});

// let dominationDimension2 = Dimension.create(dominationDesign, {
//   name: 'Domination with NO logs', 
//   loggingLevel: Dimension.Logger.LEVEL.NONE,
  
// });

let jsSource = "./js-kit/halite3/stoneBot/MyBot.js";
let simpleBot = "./js-kit/halite3/StillBot.js";
let botSources = [];

// sets up a deterministic game where all bots will end up expanding down
for (let i = 0; i < 2; i++) {
  botSources.push(jsSource);
}

for (let i = 0; i < 2; i++) {
  botSources.push(jsSource);
}

haliteLeague.createMatch(
  botSources,
  {
    name: 'test-long-halite-match',
    timeout: 1000,
    initializeConfig: {
      seed: 3,
      width: 32,
      height: 32
    },
    loggingLevel: Dimension.Logger.LEVEL.DETAIL,
    replayDirectory: './replays'
  }
).then((res) => {
  // cons/ole.log(res);
});
haliteLeague.createMatch(
  [simpleBot, simpleBot],
  {
    name: 'test-short-halite-match',
    timeout: 1000,
    initializeConfig: {
      seed: 3,
      width: 32,
      height: 32
    },
    loggingLevel: Dimension.Logger.LEVEL.DETAIL,
    replayDirectory: './replays'
  }
).then((res) => {
  // cons/ole.log(res);
})

// dominationDimension.createMatch(
//   botSources,
//   {
//     timeout: 1000,
//     initializeConfig:{
      
//       size: 4,
//       maxRounds: 10
//     }
//   }
// ).then((res) => {
//   // console.log(res);
// })