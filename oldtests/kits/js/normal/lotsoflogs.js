const kit = require('./kit');
const agent = new kit.Agent();
agent.initialize().then(async () => {
  while(true) {
    let i = 0;
    while(i < 100000) {
      console.error("Hello there im logging " + i);
      console.error("Hello there im logging twice " + i);
      i++;
    }
    console.log('R'); // tell the match you want to play Rock in the game
    agent.endTurn(); // end turn
    await agent.update(); // wait for updates
  }
});