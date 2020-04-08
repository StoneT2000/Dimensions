const Agent = require('./agent');
const agent = new Agent();
agent.initialize().then(async () => {
  let choices = ['R', 'S', 'P'];
  while(true) {
    let p = Math.random();
    if (p < 0.33) {
      console.log('R');
    }
    else if (p < 0.67) {
      console.log('P');
    }
    else {
      console.log('S');
    }

    agent.endTurn();
    await agent.update();
  }
});
