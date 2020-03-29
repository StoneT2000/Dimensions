const Agent = require('./agent');

// create a new agent
const agent = new Agent();

try {
	// first initialize the agent, and then proceed to go in a loop waiting for updates
	agent.initialize().then(async () => {
		while(true) {
			
			let pastOpponentMoves = agent.pastOpponentMoves;

			let move;
			if (pastOpponentMoves.length) {
				let lastMove = pastOpponentMoves[pastOpponentMoves.length - 1];
				switch(lastMove) {
					case 'R':
						move = 'P';
						break;
					case 'P':
						move = 'S';
						break;
					case 'S':
						move = 'R';
						break;
				}
			}
			else {
				// defaults to scissor on first round
				move = 'S';
			}

			// this agent always uses whatever move would beat the previous agent
			console.log(move);
			
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