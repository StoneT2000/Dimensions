import { Agent } from './kit';

// create a new agent
const agent = new Agent();

// first initialize the agent, and then proceed to go in a loop waiting for updates and running the AI
agent.initialize().then(async () => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    console.log('R');

    // now we end our turn
    agent.endTurn();
    // wait for update from match engine
    await agent.update();
  }
});
