const Agent = require('./agent');

// create a new agent
const agent = new Agent();

try {
	// first initialize the agent, and then proceed to go in a loop waiting for updates
	agent.initialize().then(async () => {
		while(true) {
			// wait for update from match engine
			
			// this agent always uses rock, so we always log a rock command to the match engine
			console.log('R');

			// now we end our turn
			agent.endTurn();
			await agent.update();
		}
	});
}
catch(error) {
	console.error(error);
}