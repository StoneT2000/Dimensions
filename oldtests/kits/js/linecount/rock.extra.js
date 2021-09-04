// sends an extra output to try to trick
const Agent = require('./agent_linecount');


const agent = new Agent();

try {
  // first initialize the agent, and then proceed to go in a loop waiting for updates
  agent.initialize().then(async () => {
    while(true) {
      console.log('R');
      console.log('S'); // this command gets registered as it its the latest one

      // wait for update from match engine
      await agent.update();
    }
  });
}
catch(error) {
  console.error(error);
}