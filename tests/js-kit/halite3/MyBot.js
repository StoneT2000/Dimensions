const hlt = require('./hlt');
const { Direction } = require('./hlt/positionals');
const logging = require('./hlt/logging');

const game = new hlt.Game();
game.initialize().then(async () => {
    // At this point "game" variable is populated with initial map data.
    // This is a good place to do computationally expensive start-up pre-processing.
    // As soon as you call "ready" function below, the 2 second per turn timer will start.
    await game.ready('Console Bot');

    logging.info(`My Player ID is ${game.myId}.`);
    // for (let i = 0; i < game.gameMap._cells.length; i++) {
    //     logging.info(`${game.gameMap._cells[i].map((c) => c.position)}`);
    // }
    game.players.forEach((player, id) => {
        logging.info(`Player id: ${player.id}, halite: ${player.haliteAmount}`);
        // console.error(player);
    })
    while (true) {
        await game.updateFrame();
        
        const { gameMap, me } = game;

        const commandQueue = [];
        // console.error(`I have ${me.getShips().length} ships, ${me.haliteAmount} halite`);
        for (const ship of me.getShips()) {
            if (ship.haliteAmount > hlt.constants.MAX_HALITE / 2) {
                const destination = me.shipyard.position;
                const safeMove = gameMap.naiveNavigate(ship, destination);
                commandQueue.push(ship.move(safeMove));
            }
            else if (gameMap.get(ship.position).haliteAmount < hlt.constants.MAX_HALITE / 10) {
                const direction = Direction.getAllCardinals()[Math.floor(4 * Math.random())];
                const destination = ship.position.directionalOffset(direction);
                const safeMove = gameMap.naiveNavigate(ship, destination);
                commandQueue.push(ship.move(safeMove));
                
            }
            // commandQueue.push(ship.move(Direction.South));
            // console.error(`Moving ship: ${ship.id} to ${commandQueue[commandQueue.length -1]}`);
        }

        if (game.turnNumber < 0.75 * hlt.constants.MAX_TURNS &&
            me.haliteAmount >= hlt.constants.SHIP_COST &&
            !gameMap.get(me.shipyard).isOccupied) {
            commandQueue.push(me.shipyard.spawn());
        }
        // console.error(commandQueue);
        // console.error(`Ships: ${me.getShips().length}`);
        await game.endTurn(commandQueue);
    }
});
