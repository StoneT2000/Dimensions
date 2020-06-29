const Agent = require('./agent_linecount');

// create a new agent
const agent = new Agent();

try {
  // first initialize the agent, and then proceed to go in a loop waiting for updates
  agent.initialize().then(async () => {
    while(true) {
      
      // this agent always uses paper, so we always log a paper command to the match engine
      console.log('P');
      console.log('D_FINISH');

      // wait for update from match engine
      await agent.update();
    }
  });
}
catch(error) {
  console.error(error);
}