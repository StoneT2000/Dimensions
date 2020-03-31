//nodemon --watch 'tests/**/*.ts' --watch 'src/**/*.ts' --ignore 'src/**/*.spec.ts' -exec 'ts-node' tests/server.ts 

import * as Dimension from '../src/';
const { DominationDesign } = require('./domination');

let dominationDesign = new DominationDesign('Domination');
let dominationDimension = Dimension.create(dominationDesign, 'Domination INFO logs', Dimension.Logger.LEVEL.ALL);

let dominationDimension2 = Dimension.create(dominationDesign, 'Domination NONE', Dimension.Logger.LEVEL.NONE);

let jsSource = "./tests/js-kit/domination/random.js";
let botSources = [];

// sets up a deterministic game where all bots will end up expanding down
for (let i = 0; i < 2; i++) {
  botSources.push(jsSource);
}
dominationDimension.createMatch(
  botSources,
  {
    name: 'Match with INFO',
    timeout: 1000,
    initializeConfig:{
      
      size: 4,
      maxRounds: 10
    }
  }).then((res) => {
    // console.log(res);
  })

  dominationDimension.createMatch(
    botSources,
    {
      timeout: 1000,
      initializeConfig:{
        
        size: 4,
        maxRounds: 10
      }
    }).then((res) => {
      // console.log(res);
    })