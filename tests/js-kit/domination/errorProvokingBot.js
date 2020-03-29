const Agent = require('./agent');

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

      let x = Math.floor(Math.random()* map.length);
      let y = Math.floor(Math.random()* map.length);
      expand(map.length, y);
      console.log(commands.join(','));
      agent.endTurn();
    }
  })
}
catch(error) {
  console.error(error);
}