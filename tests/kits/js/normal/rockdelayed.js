const kit = require('./kit');
const agent = new kit.Agent();
agent.initialize().then(async () => {
  while(true) {
    
    await delay();
  }
});

const delay = async () => {
  return new Promise((res) => {
    setTimeout(async () => {
      console.log('R'); // tell the match you want to play Rock in the game
      agent.endTurn(); // end turn
      await agent.update(); // wait for updates
      res();
    }, 200);
  });
}