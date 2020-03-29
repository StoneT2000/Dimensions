const Agent = require('./agent');

// create a new agent
const agent = new Agent();

try {
	// first initialize the agent, and then proceed to go in a loop waiting for updates
	agent.initialize().then(async () => {
		while(true) {
			
			// this agent always uses a fake move
			console.log('trick');

			// now we end our turn
			agent.endTurn();

			// wait for update from match engine
			await agent.update();
		}
	});
}
catch(error) {
	console.error(error);
}