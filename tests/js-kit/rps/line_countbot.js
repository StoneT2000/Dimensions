const Agent = require('./agent_linecount');

// create a new agent
const agent = new Agent();

try {
  // first initialize the agent, and then proceed to go in a loop waiting for updates
  agent.initialize().then(async () => {
    while(true) {
      
      // this agent always uses rock, so we always log a rock command to the match engine
      console.log('R\nS');
      // as we use line count, the moment we send one line, it gets logged
      
      // NOTE, match engine may be fast enough to stop the agent before it even reaches the console log here
      // so to test the erasure of output, we do R\nS above
      // console.log('S');

      // wait for update from match engine
      await agent.update();
    }
  });
}
catch(error) {
  console.error(error);
}