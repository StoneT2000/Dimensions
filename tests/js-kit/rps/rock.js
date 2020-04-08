const Agent = require('./agent');
const agent = new Agent();
agent.initialize().then(async () => {
  while(true) {
    console.log('R');
    agent.endTurn();
    await agent.update();
  }
});
