const hlt = require('./hlt');
const { Direction } = require('./hlt/positionals');
const logging = require('./hlt/logging');

const game = new hlt.Game();
game.initialize().then(async () => {
    // At this point "game" variable is populated with initial map data.
    // This is a good place to do computationally expensive start-up pre-processing.
    // As soon as you call "ready" function below, the 2 second per turn timer will start.
    await game.ready('Still Bot');

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

        await game.endTurn(commandQueue);
    }
});
