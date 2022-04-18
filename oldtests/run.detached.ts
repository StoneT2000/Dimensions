import * as Dimension from '../src';

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

let myDimension = Dimension.create(rpsDesign, {
  name: 'RPS',
  loggingLevel: Dimension.Logger.LEVEL.INFO,
  activateStation: false,
  observe: false,
  id: 'oLBptg',
});

/**
 * 1. initiate design and dimension from another process
 * 2. initiate a new blank DETATCHED match with no agents
 */

const main = async () => {
  // get initial information about agents
  const match = await myDimension.createMatch(
    [
      {
        file: 'blank',
        name: 'bot1',
      },
      {
        file: 'blank',
        name: 'bot2',
      },
    ],
    {
      detached: true,
      agentOptions: { detached: true },
      rounds: 10000,
    }
  );

  match.step([
    { agentID: 0, command: 'R' },
    { agentID: 1, command: 'S' },
  ]);
  for (let i = 0; i < 5000; i++) {
    match.step([
      { agentID: 0, command: 'R' },
      { agentID: 1, command: 'S' },
    ]);
  }
  match.step([
    { agentID: 0, command: 'R' },
    { agentID: 1, command: 'P' },
  ]);
  // console.log(match.state)
  console.log(await match.getResults());
};
main();
