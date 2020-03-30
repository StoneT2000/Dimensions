//nodemon --watch 'tests/**/*.ts' --watch 'src/**/*.ts' --ignore 'src/**/*.spec.ts' -exec 'ts-node' tests/server.ts 

import * as Dimension from '../src';
const { DominationDesign } = require('./domination');

let dominationDesign = new DominationDesign('Domination');
let dominationDimension = Dimension.create(dominationDesign, 'Domination No Log', Dimension.Logger.LEVEL.NONE);

let dominationDimension2 = Dimension.create(dominationDesign, 'Domination Info', Dimension.Logger.LEVEL.INFO);


let station = new Dimension.Station('', [dominationDimension, dominationDimension2]);

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