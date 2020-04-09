const Agent = require('./agent');
const agent = new Agent();
agent.initialize().then(async () => {
  while(true) {
    console.log('R'); // tell the match you want to play Rock in the game
    agent.endTurn(); // end turn
    await agent.update(); // wait for updates
  }
});