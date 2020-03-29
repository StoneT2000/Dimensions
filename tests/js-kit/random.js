const Agent = require('./domination/agent');

const agent = new Agent();

try {
	agent.initialize().then(async () => {
		while(true) {
			await agent.update();
			const { map } = agent;
			commands = [];

			const getNeighbors = (x, y) => {
				return [[x-1, y], [x, y-1], [x, y], [x, y+1], [x+1, y]];
			}
			const inMap = (x, y) => {
				if (x >= map.length || y >= map.length || x < 0 || y < 0) {
					return false;
				}
				return true;
			}
			const expand = (x, y) => {
				if (x < 10) {
					x = '0' + x;
				}
				if (y < 10) {
					y = '0' + y;
				}
				commands.push('e' + x + y);
			}
			const canTake = (x, y) => {
				if (map[y][x] === -1 ) {
					return true;
				}
				return false;
			}

			// Loop through entire map and look for first tile this player owns with available empty neighbor cells to take 
			// over that aren't our own cells. Expand towards a random available neighboring cell.
			loop1: {
				for (let i = 0; i < map.length; i++) {
					for (let j = 0; j < map.length; j++) {
						if (map[i][j] === agent.id) {
							let n = getNeighbors(j, i).filter((coords) => inMap(...coords) && canTake(...coords));
							
							if (n.length) {
								let coords = n[Math.floor(Math.random() * n.length)]
								expand(coords[0], coords[1]);
								break loop1;
							}
						}
					}
				}
			}
			console.log(commands.join(','));
			agent.endTurn();
		}
	})
}
catch(error) {
	console.error(error);
}