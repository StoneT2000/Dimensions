const kit = require('./kit');
const agent = new kit.Agent();
let memleak= [];
agent.initialize().then(async () => {
  while(true) {
    for (let i = 0; i < 1000000; i++) {
      memleak.push("hello");
    }
    console.log('R'); // tell the match you want to play Rock in the game
    agent.endTurn(); // end turn
    await agent.update(); // wait for updates
  }
});