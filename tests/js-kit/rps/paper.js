const kit = require('./kit');

// create a new agent
const agent = new kit.Agent();

try {
  // first initialize the agent, and then proceed to go in a loop waiting for updates
  agent.initialize().then(async () => {
    while(true) {
      
      // this agent always uses rock, so we always log a rock command to the match engine
      console.log('P');

      // now we end our turn
      // agent.endTurn();
      // testing extra output that should be deleted
      console.log('D_FINISH\nExtra Output\nShould be deleted');

      // wait for update from match engine
      await agent.update();
    }
  });
}
catch(error) {
  console.error(error);
}