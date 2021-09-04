const kit = require('./kit');
const agent = new kit.Agent();
agent.initialize().then(async () => {
  while(true) {
    console.error("Heyy")
    console.log('P'); // tell the match you want to play scissor in the game
    agent.endTurn(); // end turn
    await agent.update(); // wait for updates
  }
});