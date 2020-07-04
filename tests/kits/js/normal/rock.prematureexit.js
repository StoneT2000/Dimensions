const kit = require('./kit');
const agent = new kit.Agent();
agent.initialize().then(async () => {
  while(true) {
    console.log('\nR\n\n'); // tell the match you want to play Rock in the game
    agent.endTurn(); // end turn
    await agent.update(); // wait for updates
    process.exit(1);
    
  }
});