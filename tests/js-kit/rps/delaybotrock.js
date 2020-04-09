const kit = require('./kit');

// create a new agent
const agent = new kit.Agent();

try {
  // first initialize the agent, and then proceed to go in a loop waiting for updates
  agent.initialize().then(async () => {
    while(true) {
      
      // this agent always uses rock, so we always log a rock command to the match engine
      console.log('R');

      // now we end our turn
      await delayedTurnEnd();

      // wait for update from match engine
      await agent.update();
    }
  });
}
catch(error) {
  console.error(error);
}
const delayedTurnEnd = async () => {
  return new Promise( async (resolve, reject) => {
      setTimeout(async () => {
          await agent.endTurn();
          resolve();
      }, 500);
  })
}