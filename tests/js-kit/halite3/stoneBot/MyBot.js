const hlt = require('./hlt');
const {Direction, Position} = require('./hlt/positionals');
const logging = require('./hlt/logging');
const commands = require('./hlt/commands');
//const util = require('./utilities');
const movement = require('./utilities/movement.js');
const mining = require('./utilities/mining.js');
const mining2 = require('./utilities/mining2.js');
const search = require('./utilities/search.js');
const game = new hlt.Game();


let meta = 'normal';

let ships = {};
game.initialize().then(async () => {
  // At this point "game" variable is populated with initial map data.
  // This is a good place to do computationally expensive start-up pre-processing.
  // As soon as you call "ready" function below, the 2 second per turn timer will start.
  await game.ready('ST-Bot-Jan-12v1');

  logging.info(`My Player ID is ${game.myId}.`);
  //logging.info(`Arguments/Params: ${process.argv}`);
  const {gameMap, me} = game;
  
  let avgTime = 0;
  let totalTime = 0;
  let mapSize = gameMap.width * gameMap.height;
  let numShips = 0;
  let numDropoffs = 1;
  let maxDropoffs = 1;
  let averageHalite = 0;
  let minAverageHaliteNeeded = 50; //average halite needed in order to make ships
  let numPlayers = 0;
  let crashRatio = 1.5;
  let enemyPlayers = [];
  for (let player of game.players){
    numPlayers += 1;
    if (player[0] !== game.myId) {
      enemyPlayers.push(player[1]);
      //logging.info(`Enemy: ${player[1].shipyard.position}`)
    }
  }
  logging.info(`There are ${numPlayers} players`);
  if (numPlayers === 4) {
    minAverageHaliteNeeded = 60;
    crashRatio = -1;
  }
  averageHalite = search.totalHaliteOnMap(gameMap);
  averageHalite = averageHalite / mapSize;
  logging.info(`Average Halite: ${averageHalite}`);
  
  
  //How far ship is willing to look for potential mining spots. early game, its 1, we want more ships early on
  //later set it to two
  
  //short range is good if the halite is well evened out
  //long range is good if there are deep clusters far away and no good halite nearby.
  let shipMineRange = 1;
  
  let shipNumFutureTurnsToCalc = 4;
  
  //minimum halite around a dropoff point before we allow dropoffs to be made
  let minHaliteAroundDropoff = 18000;
  
  //global meta for how far ships should look for mining. Probably should do this on a case by case basis though.
  let mineRangeMeta = 'short';
  
  //If there's not enough in proximity
  let initialHaliteInProximity = mining.totalHaliteInRadius(gameMap, me.shipyard.position, 3);
  if (initialHaliteInProximity <= 1000) {
    logging.info(`LONG RANGE MINING`)
    mineRangeMeta = 'long';
  }
  else {
    logging.info(`SHORT RANGE MINING`)
    mineRangeMeta = 'short';
  }
  logging.info(`Map Size: ${mapSize}`);
  /*
  if (mapSize > 2500) {
    maxDropoffs = 3;
  }
  else if (mapSize > 1600) {
    maxDropoffs = 2;
  }
  */
  
  let designatedDropoffBuildPositions = []; //positions where a ship is already going to build at
  
  let incomingFShips = {}; //array of arrays of ship ids coming to a dropoff place. Add this to the number of ships in vicinity count when figuring out which loitering ships should force move somewhere.
  //incomingFShips[id1][k], id1=dropoff id, kth element gives kth ship
  
  let maxDropoffBuildDistance = 12; //max distance dropoff build place can be from nearest ship
  
  while (true) {
    
    let start = new Date().getTime();
    let shipCommands = {};
    let shipDirections = {};
    let shipDesiredPositions = {};
    
    
    await game.updateFrame();

   
    const commandQueue = [];

    let spawnedIds = []; //generated temp. Ids for new ships
    
    averageHalite = 0;
    let totalHalite = search.totalHaliteOnMap(gameMap);
    averageHalite = totalHalite / mapSize;
    logging.info(`Average Halite: ${averageHalite}`);
    
    let totalShipsThisTurn = 0;
    for (let i = 0; i < enemyPlayers.length; i++) {
      for (let enemyShip of enemyPlayers[i].getShips()) {
        totalShipsThisTurn += 1;
      }
    }
    for (let ourOwnShip of me.getShips()) {
      totalShipsThisTurn += 1;
    }
    //Calculate number of good drop off locations to put a limit on the maximum number of dropoffs so this way, the AI won't try to stack up halite to prepare to build for a dropoff that will never be built
    
    let possibleDropoffSpots = []; //Array of objects containing position and the amount of halite contained within 6 units radius of that position

    for (let i = 0; i < gameMap.width; i++) {
      for (let j = 0; j < gameMap.height; j++) {
        let gameMapPosition = (new Position(i,j));
        let nearestDropoffToHere = search.findNearestDropoff(gameMap, me, gameMapPosition);
        let distanceToNearestDropoff = gameMap.calculateDistance(gameMapPosition, nearestDropoffToHere.position);
        //check if another ship has already taken this spot
        let buildableLocation = true;
        for (let k = 0; k < designatedDropoffBuildPositions.length; k++) {
          if (gameMapPosition.equals(designatedDropoffBuildPositions[k])) {
            buildableLocation = false;
          }
          let distToDesignatedPlace = gameMap.calculateDistance(gameMapPosition, designatedDropoffBuildPositions[k]);
          if (distToDesignatedPlace < distanceToNearestDropoff) {
            distanceToNearestDropoff = distToDesignatedPlace;
          }
        }
        if (gameMapPosition.hasStructure) {
          buildableLocation = false;
        }
        if (buildableLocation === true && distanceToNearestDropoff >= 2 * 6){
          let haliteInRadiusOfThisTile = mining.totalHaliteInRadius(gameMap, gameMapPosition, 6);

          if (haliteInRadiusOfThisTile >= minHaliteAroundDropoff) {
            //12 = max distance at which we allow ships to run and build dropoff
            let shipsAround = search.shipsInRadius(gameMap, me.shipyard.owner, gameMapPosition, maxDropoffBuildDistance);
            let shipsAroundClose = search.shipsInRadius(gameMap, me.shipyard.owner, gameMapPosition, 6);
            if (shipsAround.friendly.length >= 1 && (shipsAroundClose.friendly.length >= 0.3 * shipsAroundClose.enemy.length || shipsAroundClose.enemy.length <= 2)) {
              //store position and halite amount of ideal dropoff location
              possibleDropoffSpots.push({position: gameMapPosition, halite: haliteInRadiusOfThisTile});
            }
          }
        }
      }
    }
    //goingToNewDropoff
    //dropoffsSortedByHalite contains all the dropoffs plus shipyard and the amount of halite in a 9 unit radius along with the number of ships they have nearby
    let dropoffsSortedByHalite = [{structure: me.shipyard, halite: mining.totalHaliteInRadius(gameMap, me.shipyard.position, 9)}];
    if (incomingFShips[me.shipyard.id] === undefined) {
      incomingFShips[me.shipyard.id] = [];
    }
    for (const dropoff of me.getDropoffs()) {
      if (incomingFShips[dropoff.id] === undefined) {
        incomingFShips[dropoff.id] = [];
        //logging.info(`Dropoff-${dropoff.id}; ${incomingFShips[dropoff.id].length}`);
      }
      
      //define if undefined. Also check if the ship is still alive. if not, remove from incoming
      let newArr = [];
      for (let k = 0; k < incomingFShips[dropoff.id].length; k++) {
        
        if (me.hasShip(incomingFShips[dropoff.id][k])) {
          newArr.push(incomingFShips[dropoff.id][k]);
        }
        else {
          //logging.info(`Ship-${incomingFShips[dropoff.id][k]} collided somewhere`);
        }
      }
      incomingFShips[dropoff.id] = JSON.parse(JSON.stringify(newArr));
      
      let totalHaliteAroundDropoff = mining.totalHaliteInRadius(gameMap, dropoff.position, 9);
      let shipsNear = search.shipsInRadius(gameMap, me.shipyard.owner, dropoff.position, 7);
      //fships is number of friendly ships withint 7 unit radius
      dropoffsSortedByHalite.push({structure:dropoff, halite: totalHaliteAroundDropoff, fships: shipsNear.friendly.length});
    }
    dropoffsSortedByHalite.sort(function(a,b){
      return b.halite - a.halite;
    });
    
    
    
    //DETERMINE STRATEGIES:
    //let ext = mining.extractPercent;
    //logging.info(`Extract Percent: ${ext}`);
    if (game.turnNumber >= 0.875 * hlt.constants.MAX_TURNS) {
       meta = 'final';
    }
    
    //Long range mining if the clusters are sparse
    /* NO LONGER USED
    if (game.turnNumber <= 0.3 * hlt.constants.MAX_TURNS) {
      if (mineRangeMeta === 'short'){
        shipMineRange = 1;
        shipNumFutureTurnsToCalc = 4;
      }
      else if (mineRangeMeta === 'long'){
        shipMineRange = 3;
        shipNumFutureTurnsToCalc = 8; //shoudl equal range*2 + 2
      }

    }
    else {
      shipMineRange = 2;
      shipNumFutureTurnsToCalc = 6;
    }
    */
    //tempId is assigned to about to be made ships
    let tempId = -10;
    let localHaliteCount = me.haliteAmount;
    let buildShip = false;
    let buildDropoffs = true; //whether we should let ships start to be designated to build dropoff
    if ((game.turnNumber < 0.65 * hlt.constants.MAX_TURNS && numShips <= 1.7*Math.sqrt(mapSize)) /*averageHalite >= minAverageHaliteNeeded*/) {
      //we tried copying the top bot using the below code
      //totalHalite / totalShipsthisTurn >= 870 is optimal value that top bot seems to use
      //if ((numPlayers === 4 && totalHalite / totalShipsThisTurn >= 800 && averageHalite >= minAverageHaliteNeeded) || (numPlayers === 2 && averageHalite >= minAverageHaliteNeeded)){}
      
      
      if (averageHalite >= minAverageHaliteNeeded){
        
        
        //we stack up halite if there is a ship being designated to build. no longer use numDropoffs < maxDropoffs argument
        if (me.haliteAmount >= hlt.constants.SHIP_COST) {
          if (designatedDropoffBuildPositions.length >= 1) {
            //this shouldnt be >= drop off cost, could be less due to existing halite in cargo and ground
            if (me.haliteAmount >= hlt.constants.DROPOFF_COST + 500) {
              buildShip = true;

            }
          }
          else if (numDropoffs < maxDropoffs) {
            //this way the building ship doesn't wait forever and its tagged along ships don't go all the way back to shipyard
            if (me.haliteAmount >= hlt.constants.DROPOFF_COST - 500) {
              buildShip = true;
            }
          }
          else {
            buildShip = true;
          }
          if (buildShip === true) {
            let positionsToCheck = search.circle(gameMap, me.shipyard.position, 1);
            let unopenSpots = 0;
            for (let k = 1; k < positionsToCheck.length; k++){
              let thatShipThere = gameMap.get(positionsToCheck[k]).ship
              if (thatShipThere !== null && thatShipThere.owner === me.shipyard.owner) {
                unopenSpots++;
              }
            }
            if (unopenSpots <= 3){
              commandQueue.push(me.shipyard.spawn());
              localHaliteCount -= 1000;
              shipDesiredPositions[tempId] = [me.shipyard.position];
              spawnedIds.push(tempId);
              tempId -= 1; 
            }
          }
        }
      }
      else {
        if (numPlayers === 4){
          crashRatio = 3;
        }
      }
    }
    else {
      if (numPlayers === 4){
        crashRatio = 3;
      }
    }
    logging.info(`Spawned IDS: ${spawnedIds}`);
    /*
    if (localHaliteCount >= hlt.constants.DROPOFF_COST - 200) {
      buildDropoffs = true;
    }
    */
    numShips = 0;
    let shipsDesignatedToBuild = 0; //number of ships designated to go and build dropoffs
    let shipsThatCantMove = []; //array of ships that don't have enough halite to move
    let shipsOnStructures = []; //array of ships that are on top of friendly structures and should be moving out first
    let shipsThatAreReturning = []; //array of ships that are on return mode
    let shipsThatArePerformingFinalReturn = []; //array of ships on the final mode
    let shipsThatAreBuilding = []; //array of ships that are trying to build a dropoff
    let shipsThatAreGoingToBuild = []; //array of ships that are moving to a build location
    let shipsThatAreNextToEnemyDropoff = []; //array of ships that are right next to enemy dropoff. We prioritize them for the final meta as we don't want them to crash on top of the dropoff
    let otherShips = []; //all other ships
    let prioritizedShips = []; //the prioritized array of ships in which movements and decisions should be made
    //Some unit preprocession stuff
    for (const ship of me.getShips()){
      let id = ship.id;
      numShips += 1;
      //make sure variables are defined
      if (ships[id] === undefined) {
        ships[id] = {};
        if (ships[id].targetDestination === undefined) {
          ships[id].targetDestination = null;
        }
        if (ships[id].distanceLeftToDestination === undefined) {
          ships[id].distanceLeftToDestination = 0;
        }
        ships[id].mode = 'mine';
        ships[id].targetDropoffId = -1;
      }
      
      //First set the desired positions of units who can't move cuz they have no halite or something
      if (!movement.canMove(gameMap, ship)) {
        //If unit is cant move
        shipsThatCantMove.push(ship);
        
        let directions = [Direction.Still];
        shipDirections[id] = directions;
        shipDesiredPositions[id] = [];
        shipDesiredPositions[id].push(ship.position);
      }

      else if (ships[id].mode === 'return') {
        shipsThatAreReturning.push(ship);
      }
      
      else if (ships[id].mode === 'final') {
        shipsThatArePerformingFinalReturn.push(ship);
      }
      else if (gameMap.get(ship.position).hasStructure &&  gameMap.get(ship.position).structure.owner === me.shipyard.owner){
        shipsOnStructures.push(ship);
      }
      else if (ships[id].mode === 'buildDropoff') {
        shipsThatAreBuilding.push(ship);
        shipsDesignatedToBuild += 1;
      }
      else if (ships[id].mode === 'goingToBuildDropoff'){
        shipsThatAreGoingToBuild.push(ship);
        shipsDesignatedToBuild += 1;
      }
      else {
        let pushToOtherShips = true;
        if (ships[id].mode === 'blockDropoff') {
          //prioritize blocking ships right next to enemy dropoff
          if (ships[id].targetDestination !== null) {
            let distToEnemyDropoff = gameMap.calculateDistance(ship.position, ships[id].targetDestination);
            if (distToEnemyDropoff <= 1){
              shipsThatAreNextToEnemyDropoff.push(ship);
              pushToOtherShips = false;
            }
          }
        }
        if (pushToOtherShips) {
          otherShips.push(ship);
        }
      }
    }
    
    //Build the prioritized ships array
    for (let i = 0; i < shipsThatCantMove.length; i++) {
      prioritizedShips.push(shipsThatCantMove[i]);
    }
    for (let i = 0; i < shipsOnStructures.length; i++) {
      prioritizedShips.push(shipsOnStructures[i]);
    }
    for (let i = 0; i < shipsThatAreBuilding.length; i++) {
      prioritizedShips.push(shipsThatAreBuilding[i]);
    }
    for (let i = 0; i < shipsThatAreGoingToBuild.length; i++) {
      prioritizedShips.push(shipsThatAreGoingToBuild[i]);
    }
    for (let i = 0; i < shipsThatArePerformingFinalReturn.length; i++) {
      prioritizedShips.push(shipsThatArePerformingFinalReturn[i]);
    }
    for (let i = 0; i < shipsThatAreReturning.length; i++) {
      prioritizedShips.push(shipsThatAreReturning[i]);
    }
    for (let i = 0; i < shipsThatAreNextToEnemyDropoff.length; i++) {
      prioritizedShips.push(shipsThatAreNextToEnemyDropoff[i]);
      //consider replacing this with a sorted shipsThatAreNextToEnemyDropoff array, which prioritizes those blockoff ships by distance to dropoff
    }
    for (let i = 0; i < otherShips.length; i++) {
      prioritizedShips.push(otherShips[i]);
    }
    logging.info(`Max Dropoffs: ${maxDropoffs}; Current dropoffs: ${numDropoffs}; Numships: ${numShips}`)
    //Decide on max number of dropoffs to build given the current ship count
    if (numShips <= 15) {
      maxDropoffs = 1;
    }
    else if (numShips <= 30) {
      maxDropoffs = 2;
    }
    else if (numShips <= 45) {
      maxDropoffs = 3;
    }
    else if (numShips <= 60) {
      maxDropoffs = 4;
    }
    else if (numShips <= 75) {
      maxDropoffs = 5;
    }
    else if (numShips <= 90) {
      maxDropoffs = 6;
    }
    else if (numShips <= 105) {
      maxDropoffs = 7;
    }
    else if (numShips <= 120) {
      maxDropoffs = 8;
    }
    else if (numShips <= 135) {
      maxDropoffs = 9;
    }
    maxDropoffs = Math.min(maxDropoffs, possibleDropoffSpots.length);
    
    //Sort possible dropoff spots by most amount of halite and find nearest ship and designate that ship to travel to dropoff spot
    if (numDropoffs + shipsDesignatedToBuild < maxDropoffs && buildDropoffs === true && game.turnNumber <= 0.85 * hlt.constants.MAX_TURNS) {
      //Sort by halite amount, most first, least last
      possibleDropoffSpots.sort(function(a,b){
        return b.halite - a.halite;
      })
      let designatedABuilder = false;
      let nextDropoffSpot = possibleDropoffSpots[0];
      //IMPROVEMENT: Slightly repetitive to search again as it was done already when going through the entire map to find ideal dropoff locations
      let possibleShipPositions = search.circle(gameMap, nextDropoffSpot.position, maxDropoffBuildDistance);
      for (let i = 0; i < possibleShipPositions.length; i++) {
        let possibleTileWithShip = gameMap.get(possibleShipPositions[i]);
        let thatShip = possibleTileWithShip.ship;
        //check if there is a ship within maxDropoffBuildDistance units radius and is one of our ships
        if (thatShip !== null && thatShip.owner === me.shipyard.owner) {
          //then designate that ship to build the dropoff
          if (ships[thatShip.id].mode !== 'goingToBuildDropoff'){
            let haliteCargoThere = thatShip.haliteAmount - mining.costToMoveThere(gameMap, thatShip.position, nextDropoffSpot.position)
            if (haliteCargoThere < 0) {
              haliteCargoThere = 0;
            }
            let haliteAvailable = haliteCargoThere + gameMap.get(nextDropoffSpot.position).haliteAmount + localHaliteCount;
            logging.info(`Ship-${thatShip.id}: will have ${haliteAvailable} to build with`)
            if (haliteAvailable >= hlt.constants.DROPOFF_COST) {
              ships[thatShip.id].mode = 'goingToBuildDropoff';
              shipsDesignatedToBuild += 1;
              ships[thatShip.id].targetDestination = nextDropoffSpot.position;
              logging.info(`Ship-${thatShip.id} is designated to build dropoff at ${nextDropoffSpot.position}`)
              designatedDropoffBuildPositions.push(nextDropoffSpot.position);
              designatedABuilder = true;
              //after designating a ship, get a couple other ships to come
            }
            
            
            break;
          }
        }
      }
      if (designatedABuilder === true){
        let possibleOtherShipPositions = search.circle(gameMap, nextDropoffSpot.position, 20);
        //Find other ships to tag along the designated ship
        let possibleShipsToTag = [];
        for (let i = 0; i < possibleOtherShipPositions.length; i++) {
          let possibleTileWithShip = gameMap.get(possibleOtherShipPositions[i]);
          let thatShip = possibleTileWithShip.ship;
          if (thatShip !== null && thatShip.owner === me.shipyard.owner) {
            let thatMode = ships[thatShip.id].mode;
            if (thatMode !== 'return' && thatMode !== 'goingToBuildDropoff' && thatMode !== 'buildDropoff') {
              possibleShipsToTag.push({ship:thatShip, distance: gameMap.calculateDistance(thatShip.position, nextDropoffSpot.position)});
            }
          }
        }
        //get at least 1/numofdropofss of the ships to go to the new dropoff
        let desiredNumShips = (1/(maxDropoffs)) * numShips;

        //sort by distance, least distance first
        possibleShipsToTag.sort(function(a,b){
          return a.distance - b.distance;
        })
        for (let i = 0; i < possibleShipsToTag.length; i++) {
          if (i < desiredNumShips) {
            ships[possibleShipsToTag[i].ship.id].mode = 'goingToNewDropoff';
            ships[possibleShipsToTag[i].ship.id].targetDestination = nextDropoffSpot.position;
            //logging.info(`Ship-${possibleShipsToTag[i].ship.id} is tagged to go near ${nextDropoffSpot.position}`);
          }
          else {
            break;
          }
        }
      }
    }
    
    
    //Decide on movement and strategy in order of the priorities
    for (const ship of prioritizedShips) {
      
      let id = ship.id;
      
      //If ship was given a target destination and it has reached it, set its mode to none to force the ship to rethink its current strategy.
      let reachedDropoffBuildPosition = false;
      let nearNewDropoff = false;
      if (ships[id].targetDestination !== null) {
        //if ship was tryign to block dropoff, dont remove its target destination
        if (ships[id].targetDestination.equals(ship.position) && ships[id].mode !== 'blockDropoff') {
          if (ships[id].mode === 'goingToBuildDropoff'){
            reachedDropoffBuildPosition = true;
          }
          ships[id].mode = 'none';
          ships[id].targetDestination = null;

        }
      }
      
      let oldMode = ships[id].mode;
      ships[id].mode = 'none';
      //DETERMINE SHIP MODE:
      
      //Returning mode if there is enough halite in cargo or ship was already trying to return.
      if (oldMode === 'final') {
        ships[id].mode = 'final'; //This locks the final mode in place
      }
      else if (oldMode === 'goingToBuildDropoff') {
        ships[id].mode = 'goingToBuildDropoff';
        //someone built a structure there or its no longer a viable position, go mine instead
        if (gameMap.get(ships[id].targetDestination).hasStructure) {
          ships[id].mode = 'mine';
          removePositionFromArr(ships[id].targetDestination, designatedDropoffBuildPositions);
        }
        let haliteInRadiusOfTarget = mining.totalHaliteInRadius(gameMap, ships[id].targetDestination, 6);
        if (haliteInRadiusOfTarget < minHaliteAroundDropoff) {
          ships[id].mode = 'mine';
          removePositionFromArr(ships[id].targetDestination, designatedDropoffBuildPositions);
        }
        let shipsCloseBy = search.shipsInRadius(gameMap, me.shipyard.owner, ships[id].targetDestination, 6);
        //logging.info(`Ship-${ship.id} has ${shipsCloseBy.friendly.length} friendlies and ${shipsCloseBy.enemy.length} enemies near target `);
        if (shipsCloseBy.friendly.length < 0.3 * shipsCloseBy.enemy.length && shipsCloseBy.enemy.length >= 2) {
          //too many enemies, dont build
          ships[id].mode = 'mine';
          removePositionFromArr(ships[id].targetDestination, designatedDropoffBuildPositions);
        }
      }
      //if ship reached position, it turns to building mode. It will try to always build
      else if (reachedDropoffBuildPosition === true || oldMode === 'buildDropoff') {
        ships[id].mode = 'buildDropoff';
      }
      else if (oldMode === 'blockDropoff') {
         ships[id].mode = 'blockDropoff';
      }
      else if (ship.haliteAmount >= hlt.constants.MAX_HALITE / 1.02 || oldMode === 'return') {
        ships[id].mode = 'return';
      }
      else if (oldMode === 'goingToNewDropoff') {
        ships[id].mode = 'goingToNewDropoff';
        //check if close enough yet
        if (ships[id].targetDestination !== null){
          let distToNewDropoff = gameMap.calculateDistance(ship.position, ships[id].targetDestination);
          
          //7 units is distance to new dropoff before ship returns to normal mining
          if (distToNewDropoff <= 7) {
            ships[id].mode = 'none';
            //reset its mode
          }
        }
      }
      else if (gameMap.get(ship.position).hasStructure) {
        ships[id].mode = 'mine'; //force unit to leave to allow others in
      }
      //Detect if ship is a loiterer. If the best place to mine around isn't the shipyard itself, then if the ship is loitering around, e.g mining in lowly concentrated halite area, force it move to a new dropoff loc. Also don't force it there if theres already too many ships near the other dropoff
      else if(dropoffsSortedByHalite[0].structure.position !== me.shipyard.position) {
        //we use numships/maxdropoffs to achieve an approximate even dist'n of ships on dropoffs, kinda
        //search all dropoffs by halite amounts, and check if there is space to send loitering ships there
        
        let haliteAroundHere = mining.totalHaliteInRadius(gameMap, ship.position, 9);
        

        //go through each dropoff including shipyard in order of which has the most halite in 9 unit radius
        for (let i = 0; i < dropoffsSortedByHalite.length; i++) {
          let dropoffId = dropoffsSortedByHalite[i].structure.id;
          //logging.info(`Ship-${id}; looking for dropoff-${dropoffId}`);
          let numIncomingFShips = incomingFShips[dropoffId].length;
          let numShipsNeeded = dropoffsSortedByHalite[i].halite/2000;
          //min with 8 is quite arbitrary
          //logging.info(`Ship-${ship.id}: Dropoff at ${dropoffsSortedByHalite[i].structure.position} needs ${numShipsNeeded}`)
          if (dropoffsSortedByHalite[i].fships + numIncomingFShips <= numShipsNeeded) {
            
            if (1.5 * haliteAroundHere < dropoffsSortedByHalite[i].halite) {
              ships[id].mode = 'goingToNewDropoff';
              //logging.info(`Ship-${ship.id} was caught loitering, sent to ${dropoffsSortedByHalite[i].structure.position}, which has ${dropoffsSortedByHalite[i].fships} ships near`);
              ships[id].targetDestination = dropoffsSortedByHalite[i].structure.position;
              incomingFShips[dropoffId].push(id);
              break;
            }
          }
        }
        
      }
      else {
        ships[id].mode = 'mine';
      }
      if (ships[id].mode === 'none') {
        ships[id].mode = 'mine'; //default is to go mining
      }
      
      
      //Determine if ship needs a new target destination
      let needsNewTarget = false;
      
      if (ships[id].mode !== oldMode || ships[id].targetDestination === null || ships[id].mode === 'none') {
        needsNewTarget = true;
      }
      
      let directions = [Direction.Still];
      
      let shipCanMove = movement.canMove(gameMap, ship);
      //If ship can't move, it will stay still and gather halite
      if (true){
        if (shipCanMove) {
          switch(ships[id].mode) {
            case 'return':
              //not optimized, could be optimized by storing the nearest dropoff for now, and only finding a new nearest dropoff if there is a new dropoff built
              /*
              let nearestDropoff = search.findNearestDropoff(gameMap, me, ship.position);
              ships[id].targetDestination = nearestDropoff.position;
              //Last two arguments of below are true, false = avoid and dont attack
              let distanceToNearestDropoffWhenReturning = gameMap.calculateDistance(ship.position, nearestDropoff.position);
              let avoidEnemy = true;
              if (distanceToNearestDropoffWhenReturning <= 1){
                avoidEnemy = false;
              }
              directions = movement.viableDirections(gameMap, ship, ships[id].targetDestination, avoidEnemy);
              */
              
              //ships variable is changed within the function and the change is reflected outside as well
              directions = movement.returnShip(gameMap, me, ship, ships);
              
              break;
            case 'mine':

              let newMiningDestinations = mining.nextMiningPosition(gameMap, me, ship, 20);
              //let newMiningDestinations = mining2.nextMiningPosition(gameMap, me, ship, 12);
              ships[id].targetDestination = newMiningDestinations[0];
              //prioritize ships that are mining currently
              if (newMiningDestinations[0].equals(ship.position)) {
                
              }
              let avoid = true;
              let attackOtherShip = false;
              let possibleEnemyPositions = search.circle(gameMap, ship.position, 2);
              for (let i = 0; i < possibleEnemyPositions.length; i++) {
                let possibleEnemyTile = gameMap.get(possibleEnemyPositions[i]);
                let oship = possibleEnemyTile.ship;
                
                //IMPROVEMENT: Doesn't check for which ship is best to collide into if there are several ones worth attacking
                if (oship !== null && oship.owner !== ship.owner) {
                  if (movement.worthAttacking(gameMap, ship, oship, crashRatio)) {
                    ships[id].targetDestination = oship.position;
                    attackOtherShip = true;
                    avoid = false;
                    break;
                  }
                }
              }
              if (attackOtherShip === true) {
                newMiningDestinations.unshift(ships[id].targetDestination)
              }
              if (gameMap.get(ship.position).hasStructure) {
                avoid = false;
              }
              directions = movement.viableDirections(gameMap, ship, newMiningDestinations, avoid);
              
              //add code for determining who to attack here
              break;
            case 'leaveAnywhere':
              //search for any open spot to leave and go there
              directions = movement.moveAwayFromSelf(gameMap, ship);
              break;
            case 'buildDropoff':
              directions = [Direction.Still];
              
              //store its directions to look for conflicts in the future. Fixes bug where ships that are building get collided into
              shipDirections[id] = directions;
              shipDesiredPositions[id] = [ship.position];
              break;
            case 'final':
              let finalNearestDropoff = search.findNearestDropoff(gameMap, me, ship.position);
              //IMPROVEMENT: REDUNDANT CODE HERE WITH OTHER ONE DETERMINING DIRECTION
              let dist = gameMap.calculateDistance(ship.position, finalNearestDropoff.position);
              let avoidCollisons = true;
              if (dist <= 3) {
                avoidCollisons = false;
              }
              directions = movement.finalMove(gameMap, ship, finalNearestDropoff, avoidCollisons);
              break;
            case 'goingToBuildDropoff':
              
              //keep going to the build place as long as its still has no structure
              
              directions = movement.viableDirections(gameMap, ship, [ships[id].targetDestination], true);
              //logging.info(`Ship-${ship.id} is going to build with directions: ${directions}`)
              break;
            case 'goingToNewDropoff':
              directions = movement.viableDirections(gameMap, ship, [ships[id].targetDestination], true, true);
              break;
            case 'blockDropoff':
              let distanceLeftToDropoff = gameMap.calculateDistance(ship.position, ships[id].targetDestination)
              let positionsAroundDropoff = search.circle(gameMap, ships[id].targetDestination, 2);
              //when blocking, most desired positions is the ship position itself if the distance is less than 1, and then the positions around the dropoff within 2 unit radius. If distance is too far from dropoff, target is the dropoff.
              let desiredPositions = [ship.position];
              for (let k = 1; k < positionsAroundDropoff.length; k++) {
                desiredPositions.push(positionsAroundDropoff[k]);
              }
              if (distanceLeftToDropoff <= 2) {
                //while blocking, seek out the higher halite enemies
                /* not used at the moment
                let possibleEnemyPositions = search.circle(gameMap, ship.position, 2);
                for (let i = 0; i < possibleEnemyPositions.length; i++) {
                  let possibleEnemyTile = gameMap.get(possibleEnemyPositions[i]);
                  let oship = possibleEnemyTile.ship;

                  //IMPROVEMENT: Doesn't check for which ship is best to collide into if there are several ones worth attacking
                  if (oship !== null && oship.owner !== ship.owner) {
                    //attack if there is more halite in other ship and we put false to say that we dont need any friends to pick up remains
                    if (movement.worthAttacking(gameMap, ship, oship, 1, false)) {
                      desiredPositions.unshift(oship.position);
                      break;
                    }
                  }
                }
                */
                //while blocking, shift position around by looking for which direction has ships coming in
                //look for in which direction is there the most enemies, look ahead 4 units
                let enemyUnitsNorth = search.shipsInDirection(gameMap, ship.owner, ships[id].targetDestination, Direction.North, 4).enemy.length;
                let enemyUnitsSouth = search.shipsInDirection(gameMap, ship.owner, ships[id].targetDestination, Direction.South, 4).enemy.length;
                let enemyUnitsEast = search.shipsInDirection(gameMap, ship.owner, ships[id].targetDestination, Direction.East, 4).enemy.length;
                let enemyUnitsWest = search.shipsInDirection(gameMap, ship.owner, ships[id].targetDestination, Direction.West, 4).enemy.length;
                
                let numUnitsInDirections = [{num:enemyUnitsNorth, dir:Direction.North}, {num:enemyUnitsSouth, dir:Direction.South}, {num: enemyUnitsEast, dir: Direction.East}, {num:enemyUnitsWest, dir: Direction.West}];
                //sort direction by which has the most units in 4 units in that direction from enemy dropoff
                numUnitsInDirections.sort(function(a,b){
                  return b.num - a.num;
                });
                //Then check which direction is already blocked, and go for the next best one to block
                
                
                //logging.info(`Ship-${ship.id} prioritizes ${numUnitsInDirections[0].dir} with most units in 4 units as n:${enemyUnitsNorth}, s:${enemyUnitsSouth},e:${enemyUnitsEast},w:${enemyUnitsWest} from ${ships[id].targetDestination}`);
                let positionWithMostUnits = null;
                for (let k = 0; k < numUnitsInDirections.length; k++) {
                  let checkTile = gameMap.get(ships[id].targetDestination.directionalOffset(numUnitsInDirections[k].dir));
                  if (checkTile.ship === null || checkTile.ship.owner !== ship.owner) {
                    positionWithMostUnits = gameMap.normalize(ships[id].targetDestination.directionalOffset(numUnitsInDirections[k].dir));
                    break;
                  }
                }
                if (positionWithMostUnits === null) {
                  //if all those surrounding positions have a friendly already, just try to go to the one with the most ships.
                  positionWithMostUnits = gameMap.normalize(ships[id].targetDestination.directionalOffset(numUnitsInDirections[0].dir));
                }
                //logging.info(`Ship-${ship.id} ends up trying to go to ${positionWithMostUnits}`);
                desiredPositions.unshift(positionWithMostUnits)
                if (distanceLeftToDropoff <= 1){
                  directions = movement.viableDirections(gameMap, ship, desiredPositions, false, false, true, ships[id].targetDestination);
                }
                else {
                  directions = movement.viableDirections(gameMap, ship, desiredPositions, false);
                }
              }
              else {
                let avoidShips = false;
                if (distanceLeftToDropoff <= 4) {
                  avoidShips = false;
                }
                else {
                  //if nearby enemy ships that ship can collide into have a lot of halite, don't avoid
                  //let existShipWeDontWantCollisionWith =  false;
                  let positionsToCheck = search.circle(gameMap, ship.position, 2);
                  for (let k = 0; k < positionsToCheck.length; k++) {
                    let gameTileToCheck = gameMap.get(positionsToCheck[k]);
                    let oship = gameTileToCheck.ship;
                    if (oship !== null && oship.owner !== ship.owner) {
                      if (oship.haliteAmount < ship.haliteAmount) {
                        //existShipWeDontWantCollisionWith = true;
                        avoidShips = true;
                        break;
                      }
                    }
                  }
                }
                //logging.info(`Ship-${ship.id} will avoid:${avoidShips} while trying to block`);
                directions = movement.viableDirections(gameMap, ship, [ships[id].targetDestination], avoidShips);
              }
              break;
          }
        }
      }

      //If nearing end of game, prepare to perform calculations for final return to dropoff. Do this once, once its on its final return, let it destroy itself ontop of the dropoff instead of doing more mining if it comes back too early.
      if (meta === 'final' && ships[id].mode !== 'final' && ships[id].mode !== 'blockDropoff') {
        let blockDropoff = false;

          if (ship.haliteAmount <= 50) {
            blockDropoff = true;
            ships[id].mode = 'blockDropoff';

          }
        if (blockDropoff === true) {
          let closestDist = 100000;
          let mostEnemies = -1;
          let nearestEnemyDropoff;
          let bestEnemyDropoff;
          //decide on which dropoff to go to
          for (let k = 0; k < enemyPlayers.length; k++) {
            for (let enemyDropoff of enemyPlayers[k].getDropoffs()){
              //let nearestEnemyDropoffTemp = search.findNearestDropoff(gameMap, enemyPlayers[k], ship.position, true);
              let locationOfDropoff = enemyDropoff.position;
              let numEnemies = search.shipsInRadius(gameMap, ship.owner, locationOfDropoff, 16).enemy.length;
              let distToDropoff = gameMap.calculateDistance(ship.position, locationOfDropoff);
              if (distToDropoff <= (hlt.constants.MAX_TURNS - 8) - game.turnNumber) {
                logging.info(`Ship-${ship.id} has enough time to reach ${locationOfDropoff}, which has ${numEnemies} enemies in 16 unit radius`)
                if (numEnemies > mostEnemies) {
                  mostEnemies = numEnemies;
                  bestEnemyDropoff = enemyDropoff;
                }
                else if (numEnemies === mostEnemies) {
                  if (distToDropoff < gameMap.calculateDistance(ship.position, bestEnemyDropoff.position)) {
                    mostEnemies = numEnemies;
                    bestEnemyDropoff = enemyDropoff;
                  }
                }
              }

              if (closestDist > distToDropoff) {
                closestDist = distToDropoff
                nearestEnemyDropoff = enemyDropoff;
              }
            }
            let locationOfShipyard = enemyPlayers[k].shipyard.position;
            let numEnemiesAroundShipyard = search.shipsInRadius(gameMap, ship.owner, locationOfShipyard, 16).enemy.length;
            
            let distToShipyard = gameMap.calculateDistance(ship.position, locationOfShipyard);
            if (distToShipyard <= (hlt.constants.MAX_TURNS - 8) - game.turnNumber) {
              logging.info(`Ship-${ship.id} has enough time to reach ${locationOfShipyard}, which has ${numEnemiesAroundShipyard} enemies in 16 unit radius`)
              if (numEnemiesAroundShipyard > mostEnemies) {
                mostEnemies = numEnemiesAroundShipyard;
                bestEnemyDropoff = enemyPlayers[k].shipyard;
              }
              else if (numEnemiesAroundShipyard === mostEnemies) {
                if (distToShipyard < gameMap.calculateDistance(ship.position, bestEnemyDropoff.position)) {
                  mostEnemies = numEnemiesAroundShipyard;
                  bestEnemyDropoff = enemyPlayers[k].shipyard;
                }
              }
            }

            if (closestDist > distToShipyard) {
              closestDist = distToShipyard
              nearestEnemyDropoff = enemyPlayers[k].shipyard;
            }
          }
          if (mostEnemies === -1) {
            ships[id].targetDestination = nearestEnemyDropoff.position;
          }
          else {
             ships[id].targetDestination = bestEnemyDropoff.position;
          }
          //logging.info(`Ship-${ship.id} is trying to block dropoff at ${nearestEnemyDropoff.nearest.position}`)
         
        } 
        else {
          let nearestDropoff = search.findNearestDropoff(gameMap, me, ship.position, true);
          let turnsLeft = hlt.constants.MAX_TURNS - game.turnNumber
          let distanceToDropoff = nearestDropoff.distance;
          turnsLeft -= (1 + numDropoffs/2 + (numShips/3.5)/numDropoffs);
          //logging.info(`Ship-${ship.id}: turnsleft: ${turnsLeft}, dist: ${distanceToDropoff}`)
          if (distanceToDropoff >= turnsLeft) {
            ships[id].mode = 'final';
            ships[id].targetDestination = nearestDropoff.nearest.position;
            directions = movement.finalMove(gameMap, ship, nearestDropoff.nearest, true); 
          }
        }
        
        /*
        let turnsLeft = hlt.constants.MAX_TURNS - game.turnNumber;
        turnsLeft -= 10; //10 turn padding, might want to increase this due to possible collisions and inefficiency;
        let distToDropoff = gameMap.calculateDistance(ship.position, nearestDropoff.position);
        */
        
        
      }
      
      if (ships[id].mode === 'buildDropoff') {
        let haliteAvailable = localHaliteCount + ship.haliteAmount + gameMap.get(ship.position).haliteAmount;
        if (haliteAvailable >= hlt.constants.DROPOFF_COST && !gameMap.get(ship.position).hasStructure){
          commandQueue.push(ship.makeDropoff());
          logging.info(`Building with ship-${id}`)
          localHaliteCount -= (hlt.constants.DROPOFF_COST - ship.haliteAmount - gameMap.get(ship.position).haliteAmount);

          removePositionFromArr(ship.position, designatedDropoffBuildPositions);

          numDropoffs += 1;
          delete shipDirections[id];
          delete shipDesiredPositions[id];
        }


      }
      else if(shipCanMove){
        //Send out desired directions of movement by preference. If one direction doesn't work, do the next.

        //Go through all past desired positions and check for conflicts. We assume that all previous selected desiredpositions arrays, the first element in there is the choice that is clean and avoids collision. Remove collision ones by shifting array
        //check ships within area, not implemented YET

        shipDirections[id] = directions;
        shipDesiredPositions[id] = [];
        //logging.info(`Ship-${ship.id} has directions: ${directions}`)
        //logging.info(`Ship-${ship.id} at ${ship.position} direction order: ${directions}`);
        //Store the desired positions
        for (let j = 0; j < directions.length; j++) {
          shipDesiredPositions[id].push(gameMap.normalize(ship.position.directionalOffset(directions[j])));
        }

        //logging.info(`Desired Positions: ${shipDesiredPositions}`);
        //WE ALSO ASSUME THAT THERES ALWAYS A DIRECTION THAT WONT RESULT IN COLLISION
        
        let allowConflicts = false;
        if (meta === 'final') {
          let nearestDropoff = search.findNearestDropoff(gameMap, me, ship.position);
          let dist = gameMap.calculateDistance(ship.position, nearestDropoff.position);
          if (dist <= 1 && ships[id].mode === 'final') {
            //allow conflicts/collisions
            allowConflicts = true;
          }
        }
        //If the ship has desired positions and we don't allow it to collide with any other ship...
        if (shipDesiredPositions[id].length >= 1 && allowConflicts === false){
          
          //let originalPositions = JSON.parse(JSON.stringify(shipDesiredPositions[id]));
          //let originalDirections = JSON.parse(JSON.stringify(shipDirections[id]));
          
          //find the non conflicting positions and directions wanted
          let desiredPositionsAndDirections = movement.findNonConflictingMoves(gameMap, ship, shipDesiredPositions, shipDirections, spawnedIds);
          //Set all possible non conflicting directions and positions
          shipDesiredPositions[id] = desiredPositionsAndDirections.positions//nonConflictDesiredPositions
          shipDirections[id] = desiredPositionsAndDirections.directions//nonConflictDirections

          //If after checking for conflicts, there are no desired positions we can't do anything as the function movement.viableDirections returns all cardinal directions

          //force a direction if no direction left or if there is no halite below and only direction so far is still
          if (shipDesiredPositions[id].length === 0) {
            logging.info(`Ship-${id} PANIC: NO AVAILABLE PLACES TO GO from ${ship.position}`);
            //Reload the directions that the ship wanted to go in, and check in which of those of which there are conflicts, whether the other conflicting ship has otehr available directions to move to.
            //originalPositions;
            //originalDirections;
            
            //dandid means position and id
            
            let navigatedOut = false;
            
            
            //dandid = directions and id
            for (let dandid of desiredPositionsAndDirections.conflictDirectionsAndId) {

              let otherId = dandid.id;
              //try to find other pos and dirs for ship with id:otherId, given that this ship with id: id wants to go pandd.position
              //We send a temporarily changed version of shipDesiredPositions and shipDirections, by inserting dandid.direction into it
              let conflictPosition = gameMap.normalize(ship.position.directionalOffset(dandid.direction));
              let shipDesiredPositionsTemp = shipDesiredPositions;
              let shipDirectionsTemp = shipDirections;
              shipDesiredPositionsTemp[id] = [conflictPosition];
              shipDirectionsTemp[id] = [dandid.direction];
              
              //find non conflicting moves for the other ship and see if it can go somewhere else
              let otherShip = me.getShip(otherId);
              if (otherShip === undefined) {
                continue; 
              }
              let otherDesiredPositionsAndDirections = movement.findNonConflictingMoves(gameMap, me.getShip(otherId), shipDesiredPositionsTemp, shipDirectionsTemp, spawnedIds)
              
              //if there are open places for the ship with id: otherID to go, make it go there
              if (otherDesiredPositionsAndDirections.positions.length > 0) {
                shipDesiredPositions = shipDesiredPositionsTemp;
                shipDesiredPositions[otherId] = otherDesiredPositionsAndDirections.positions;
                shipDirections = shipDirectionsTemp;
                shipDirections[otherId] = otherDesiredPositionsAndDirections.directions;
                
                logging.info(`Ship-${id} PANIC: SUCCESSFULLY NAVIGATED OUT by moving to ${conflictPosition}, forcing Ship-${otherId} to move to ${otherDesiredPositionsAndDirections.positions[0]}`);
                navigatedOut = true;
                break;
              }
              
            }
            if (navigatedOut) {
              
            }
            else {
              logging.info(`Ship-${id} PANIC: AFTER 1 DEGREE OF CHECKING, NO PLACES TO GO FROM ${ship.position}`);


              //if its the final part of game, let ship go to dropoff

              shipDirections[id] = [Direction.Still];
              shipDesiredPositions[id] = [ship.position];

              if (meta === 'final') {
                let panic_nearestDropoff = search.findNearestDropoff(gameMap, me, ship.position, true);
                let panic_nearestDropoffDist = panic_nearestDropoff.distance;
                if (panic_nearestDropoffDist <= 1) {
                  logging.info(`PANIC: move to dropoff: ${panic_nearestDropoff.nearest.position}`)
                  shipDesiredPositions[id] = [panic_nearestDropoff.nearest.position];
                  shipDirections[id] = movement.finalMove(gameMap, ship, panic_nearestDropoff.nearest, false);
                }
              }
            }
            
          }
          
        }
        //logging.info(`Ship-${ship.id} at ${ship.position} final direction order: ${directions}`);
      }
      //extra bit of code ships that are going to build dropoffs
      // if ship trying to reach building location is stuck because of nearby enemies, it will attempt to build where it is if conditions are met and its close enough to the build location
      if (ships[id].mode === 'goingToBuildDropoff') {
        if (shipDirections[id].length > 0 && shipDirections[id][0].equals(Direction.Still) && shipCanMove) {
          //if ship is trying to go to a build location but its direction is still and it can move, we know that the ship is likely stuck somehow
          logging.info(`Ship-${ship.id} is possibly stuck at ${ship.position}`);
          if (ships[id].targetDestination !== null) {
            let distanceToBuildLocation = gameMap.calculateDistance(ship.position, ships[id].targetDestination)
            if (distanceToBuildLocation <= 4) {
              //if within 4 units of build location
              //we check for an enemy in 2 unit radius. If there is an enemy, then we declare this ship as stuck. Otherwise false alarm
              let shipsNearbyShipTryingToGoToBuild = search.shipsInRadius(gameMap, ship.owner, ship.position, 2);
              if (shipsNearbyShipTryingToGoToBuild.enemy.length > 0) {
                //we are stuck, run code for building
                
                  let haliteAvailable = localHaliteCount + ship.haliteAmount + gameMap.get(ship.position).haliteAmount;
                  if (haliteAvailable >= hlt.constants.DROPOFF_COST && !gameMap.get(ship.position).hasStructure) {
                    commandQueue.push(ship.makeDropoff());
                    logging.info(`Building with ship-${id}`)
                    localHaliteCount -= (hlt.constants.DROPOFF_COST - ship.haliteAmount - gameMap.get(ship.position).haliteAmount);

                    removePositionFromArr(ship.position, designatedDropoffBuildPositions);

                    numDropoffs += 1;
                    delete shipDirections[id];
                    delete shipDesiredPositions[id];
                  }
              }
            }
          }
        }
      }
      
      
    }
    
    
    //Process commands of ships and look for collisions
    //If there are multiple ships wanting to go to one place, randomly choose one ship to go to that position, the other ship must then 
    
    
    //Push all the commands
    for (const ship of me.getShips()) {
      let id = ship.id;
      //logging.info (`New Command: ${shipCommands[id]}`);
      if (shipDirections[id] !== undefined){
        commandQueue.push(ship.move(shipDirections[id][0]));
      }
    }
    
    
    await game.endTurn(commandQueue);
    let end = new Date().getTime();
    let time = end - start;
    totalTime += time;
    avgTime = totalTime/game.turnNumber;
    logging.info(`Turn took: ${time} ms; AvgTime: ${avgTime}`);
  }
});

function removePositionFromArr(pos, arr){
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].equals(pos)) {
      arr.splice(i,1);
      break;
    }
  }
}