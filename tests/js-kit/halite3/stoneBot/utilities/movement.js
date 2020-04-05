const hlt = require('./../hlt');
const { Direction, Position } = require('./../hlt/positionals');
const search = require('./search.js')
const logging = require('./../hlt/logging');
function canMove(gameMap, ship) {
  if (ship.haliteAmount >= Math.floor(gameMap.get(ship.position).haliteAmount * 0.1)) {
    return true;
  }
  return false;
}

//Returns all directions towards target, with a preference order. First element is most preferred
//Disregards whether or not path is blocked by own ship
//If attack is true the ship is allowed to collide with opponent

//viableDirections always returns an array sorted by priority the directions should be in order to reach targetPos and avoid or don't avoid enemies. All directions are present in the array.
//(0. ALWAYS avoid friendly collisions, this is satisfied by code in MyBot.js)
//1. ALLOW enemy collisions if avoid === false. If avoid === true (as needed by return ships), avoid collision

//How do we prioritize which directions to move?
//1. Find directions that go towards the target position. Add the still direction next as its better than moving away the target position
//2. Determine which of the directions are safe and put that in the array safeDirections
//3.1. If avoid is true, prioritize all absoluteSafeDirections in the order of which is closer to the target position.
//3.2. If avoid is false, allow collisions to occur in attempt to reach the targetPos
//4. If no absoluteSafeDirections available, prioritize safeDirections in order which they have less enemies directly near


function viableDirections(gameMap, ship, targetPositions, avoid, findCleanSpot = false, avoidStructures = false, avoidThisStructurePos = null) {
  //Gets directions that move towards the target position
  let directions = gameMap.getUnsafeMoves(ship.position, targetPositions[0]);
  
  //if findCleanSpot is set to true, we choose a position by which has least friendlies near
  
  if (directions.length === 0){
    //If there are no directions to the targetPosition, set still as a direction
    directions = [new Direction(0, 0)];
    //logging.info(`Ship-${ship.id} is still at ${ship.position}`);
  }
  
  //this block of code determines the directions to move resulting from unsafe moves

  //If there are 2 directions towards target, they have the same distance away, so swap them depending on which leads to less halite loss. This isn't redundant as this will be used by ships who aren't avoiding enemies
  if (directions.length >= 2) {
    if (avoidStructures === false && findCleanSpot === false){
      let halite0 = gameMap.get(ship.position.directionalOffset(directions[0])).haliteAmount;
      let halite1 = gameMap.get(ship.position.directionalOffset(directions[1])).haliteAmount;
      if (halite0 > halite1) {
        let tempDirection = directions[0];
        directions[0] = directions[1];
        directions[1] = tempDirection;
      }
    }
    else if (avoidStructures === true) {
      //prefer the direction that doesnt go over the structure
      let structure0 = gameMap.get(ship.position.directionalOffset(directions[0])).hasStructure;
      if (structure0 === true) {
        let tempDirection = directions[0];
        directions[0] = directions[1];
        directions[1] = tempDirection;
      }
    }

  }
  else if (directions.length === 1 && avoidStructures === true) {
    //a direction length of 1 and avoiding structures === true means a blocker attempting to run across a structure as its the only option, instead it should prefer left or right. It will prefer which ever one has an enemy ship
    //this is a high level of micro managing
    //we decide the preferred directions directly from this block if there are adjacnet enemy ships to the dropoff
    let numEnemiesAdjacentEnemyDropoff = search.shipsInRadius(gameMap, ship.owner, avoidThisStructurePos, 1).enemy.length;

    let idir = directions[0]; //idir is the initial intended direction, which must be the direction towards the dropoff
    //logging.info(`Ship-${ship.id} intends move ${idir}`);
    let firstDirIsStill = false;
    if (idir.equals(Direction.Still)) {
      //if ship is still, it may get pushed onto the structure because of other ships and conflicting moves
      let dirToEnemyDropoff = gameMap.getUnsafeMoves(ship.position, avoidThisStructurePos);
      idir = dirToEnemyDropoff[0]; //we set idir to the direction the enemy dropoff, in order to kickstart the section of code which determines where the ship should go if it ends up staying still.
      //we still prioritize staying still if possible, but reprirotizie the rest of the directions
      firstDirIsStill = true;
      logging.info(`Ship-${ship.id} might run across ${avoidThisStructurePos} as it wants to stay still, dir to enemy dropoff is ${idir}`);
    }
    
    
    
    if (idir.equals(Direction.North) || idir.equals(Direction.South)){
      directions = [Direction.East, Direction.West];
      if (firstDirIsStill) {
        directions.unshift(Direction.Still);
      }
      let secondChoiceTile = gameMap.get(ship.position.directionalOffset(directions[1]));
      if (secondChoiceTile.ship !== null && secondChoiceTile.ship.owner !== ship.owner){
        //switch direction choice if one of them has an enemy on that tile so we can crash on them
        let tempDirection = directions[0];
        directions[0] = directions[1];
        directions[1] = tempDirection;
      }
      if (numEnemiesAdjacentEnemyDropoff > 0) {
        logging.info(`Ship-${ship.id} is preparing to run across ${avoidThisStructurePos} with an enemy near`)
        directions.push(Direction.Still);
        if (idir.equals(Direction.North)) {
          directions.push(Direction.South);
          directions.push(Direction.North);
        }
        else {
          directions.push(Direction.South);
          directions.push(Direction.North);
        }
        return directions;
      }
    }
    else if (idir.equals(Direction.East) || idir.equals(Direction.West)){
      directions = [Direction.North, Direction.South];
      if (firstDirIsStill) {
        directions.unshift(Direction.Still);
      }
      let secondChoiceTile = gameMap.get(ship.position.directionalOffset(directions[1]));
      if (secondChoiceTile.ship !== null && secondChoiceTile.ship.owner !== ship.owner){
        let tempDirection = directions[0];
        directions[0] = directions[1];
        directions[1] = tempDirection;
      }
      if (numEnemiesAdjacentEnemyDropoff > 0) {
        logging.info(`Ship-${ship.id} is preparing to run across ${avoidThisStructurePos} with an enemy near`)
        directions.push(Direction.Still);
        if (idir.equals(Direction.East)) {
          directions.push(Direction.West);
          directions.push(Direction.East);
        }
        else {
          directions.push(Direction.East);
          directions.push(Direction.West);
        }
        return directions;
      }

    }
  }
  //doing nothing is always an option and an better option than moving in a direction not towards target position
  directions.push(new Direction(0, 0));
  
  let absoluteSafeDirections = []; //all absolute safe directions. It is absolutely safe if there isn't any enemy ship adjacent to the tile this ship reaches by taking that direction
  let safeDirections = []; //all safe directions that don't have an enemy directly on the tile this ship might move to.
  let attackDirections = []; //directions in which the ship can take to try and attack an enemy
  
  let allDirections = [Direction.Still, Direction.North, Direction.South, Direction.East, Direction.West ] //all directions the ship can take
  
  //go through directions and check surrounding squares to avoid
  
  //Goes through all directions and checks surrounding squares if there is an enemy on it to see which directions are absolutely safe and which are just safe only if we are trying to avoid enemies
  
  if (avoid === true){
    for (let i = 0; i < allDirections.length; i++) {
      //position in searched direction
      let possiblePosition = ship.position.directionalOffset(allDirections[i]);
      
      //Find all adjacent positions to the position in the searched direction
      let possiblePositionsNearby = search.circle(gameMap, possiblePosition, 1);
      
      let isThisAbsoluteSafe = true; //whether possiblePosition is absolutely safe
      let isThisSafe = true; //whether possiblePosition is safe
      let numEnemies = 0;
      for (let j = 0; j < possiblePositionsNearby.length; j++) {
        let possiblePositionNearbyTile = gameMap.get(possiblePositionsNearby[j]);
        let oship = possiblePositionNearbyTile.ship;
        if (oship !== null && oship.owner !== ship.owner) {
          //if there is a ship on the adjacent tile and the owner of the ship isn't the same owner as this ship (enemy)
          numEnemies += 1;
          //Set this direction as not safe.
          isThisAbsoluteSafe = false;
          if (j === 0) {
            //The way search.circle works is it performs a BFS search for the closest squares in radius 1 (although a little cheated as we use a sorted look up table). The first element of possiblePositions is then always the original square that was searched around.
            isThisSafe = false;
          }
        }
      }
      if (isThisAbsoluteSafe === true) {
        let distanceAway = gameMap.calculateDistance(possiblePosition,targetPositions[0]);
        //logging.info(`Ship-${ship.id} at ${ship.position} has absolute safe direction: ${allDirections[i]} ${distanceAway} away`);
        absoluteSafeDirections.push({dir:allDirections[i], dist:distanceAway, enemies: numEnemies});
      }
      if (isThisSafe === true) {
        safeDirections.push({dir:allDirections[i], dist:gameMap.calculateDistance(possiblePosition,targetPositions[0]), enemies: numEnemies})
      }
    }
    //Sort absolute safe directions by which is closer to target position
    let sortedAbsoluteSafeDirections = [];
    absoluteSafeDirections.sort(function(a,b){
      return a.dist - b.dist;
    });
    if (absoluteSafeDirections.length >= 2){
      if (findCleanSpot === false){
        //findCleanSpot === false means we prioritize the direction that is cheaper to move off from
        //If two absolute safe directions get the same distance, choose one with less halite cost
        //This is a very narrowsighted method to find cheaper path. Checks only one move
        if (absoluteSafeDirections[0].dist === absoluteSafeDirections[1].dist) {
          let halite0 = gameMap.get(ship.position.directionalOffset(absoluteSafeDirections[0].dir)).haliteAmount;
          let halite1 = gameMap.get(ship.position.directionalOffset(absoluteSafeDirections[1].dir)).haliteAmount;
          if (halite0 > halite1) {
            let tempASD = absoluteSafeDirections[0];
            absoluteSafeDirections[0] = absoluteSafeDirections[1];
            absoluteSafeDirections[1] = tempASD;
            //logging.info(`Ship-${ship.id} switched directions from ${tempASD.dir} to ${absoluteSafeDirections[0].dir}`);
          }
        }
      }
      else {
        //findCleanSpot === true means we prioritize the direction that has less friendlies nearby. Avoids bunching up in lines
        if (absoluteSafeDirections[0].dist === absoluteSafeDirections[1].dist) {
          let position0 = gameMap.normalize(ship.position.directionalOffset(absoluteSafeDirections[0].dir));
          let position1 = gameMap.normalize(ship.position.directionalOffset(absoluteSafeDirections[1].dir));
          let friendliesNearPos0 = search.shipsInRadius(gameMap, ship.owner, position0, 1).friendly.length;
          let friendliesNearPos1 = search.shipsInRadius(gameMap, ship.owner, position1, 1).friendly.length;
          if (friendliesNearPos0 > friendliesNearPos1) {
            let tempDir = absoluteSafeDirections[0]
            absoluteSafeDirections[0] = absoluteSafeDirections[1];
            absoluteSafeDirections[1] = tempDir;
          }
        }
      }
    }
    
  }
  //By now, we have an array of absolute safe directions and safe directions, chosen dependent on enemies nearby and whichever is closer to targetPositions[0], the best target position for the ship at the time
  
  
  //If trying to avoid enemy ships but there are no absolutely safe directions, then choose safe directions with least enemies around and out of those, find the closest to target
  
  let directionsAndDistance = [];
  if (avoid === true) {
    if (absoluteSafeDirections.length === 0) {
      if (safeDirections.length === 0) {
        //if there are 0 safe directions
        
        directionsAndDistance = [{dir:Direction.Still, dist: 0}];
        
      }
      else {
        //If there are some safe directions, look through them
        let possibleSafeDirections = [];
        let leastEnemyCount = 1000;
        for (let j = 0; j < safeDirections.length; j++) {
          if (safeDirections[j].enemies < leastEnemyCount) {
            //reset that array as a direction with less enemies was found
            possibleSafeDirections = [safeDirections[j]];
          }
          else if (safeDirections[j].enemies === leastEnemyCount) {
            //Add safe direction that has the least enemies nearby
            possibleSafeDirections.push(safeDirections[j]);
          }
        }
        //sort the directions with the least enemies nearby by distance
        possibleSafeDirections.sort(function(a,b){
          return a.dist - b.dist;
        })
        directionsAndDistance = possibleSafeDirections.map(function(a){
          return a;
        });
      }
    }
    else {
      directionsAndDistance = absoluteSafeDirections.map(function(a){
        return a;
      });
    }
  }

  //By now, directionsAndDistance will include the safest directions (and dist) possible ordered by closeness to targetPositions[0]
  
  //Now we build a new array of directions that go into the direction of other less desired target positions
  let otherDirections = [];
  for (let k = 1; k < targetPositions.length; k++) {
    let nextOtherDirections = gameMap.getUnsafeMoves(ship.position, targetPositions[k]);
    for (let t = 0; t< nextOtherDirections.length; t++) {
      otherDirections.push(nextOtherDirections[t]);
    }
  }
  //logging.info(`Ship-${ship.id} has other directions: ${otherDirections}`)
  //using this new array, we concat it so only unique directions are left. Then compare with the current directions array that is all safe
  let uniqueOtherDirections = [];
  for (let k = 0; k < otherDirections.length; k++) {
    let unique = true;
    for (let t = 0; t < uniqueOtherDirections.length; t++) {
      if (uniqueOtherDirections[t].equals(otherDirections[k])) {
        unique = false;
      }
    }
    if (unique === true) {
      uniqueOtherDirections.push(otherDirections[k]);
    }
  }
  //logging.info(`Ship-${ship.id} has other unique directions: ${uniqueOtherDirections}`);
  //By now, uniqueOtherDirections is ordered by desirability of target position that the direction goes to.
  
  //check in the current directions list for the ones that are the same
  if (directionsAndDistance.length === 1) {
    
    directions = [directionsAndDistance[0].dir];
  }
  else if (directionsAndDistance.length >= 2) {
    let newSortedDirectionsByOtherTargets = [];
    //first leave the best directions alone
    let startIteration = 0;
    if (directionsAndDistance[0].dist === directionsAndDistance[1].dist) {
      startIteration = 2;
      newSortedDirectionsByOtherTargets = [directionsAndDistance[0].dir, directionsAndDistance[1].dir];
    }
    else {
      startIteration = 1;
      newSortedDirectionsByOtherTargets = [directionsAndDistance[0].dir];
    }
    for (let k = 0; k < uniqueOtherDirections.length; k++) {
      for (let t = startIteration; t < directionsAndDistance.length; t++) {
        if (uniqueOtherDirections[k].equals(directionsAndDistance[t].dir)){
          newSortedDirectionsByOtherTargets.push(directionsAndDistance[t].dir);
        }
        
      }
    }
    directions = newSortedDirectionsByOtherTargets;
  }
  
  //Add remaining directions to allow flexibility in movement in case of conflicts
  //Then sort the remaining directions by uniqueOtherDirections
  
  
  
  let diffDir = [];
  for (let i = 0; i < allDirections.length; i++) {
    let isItThere = false;
    for (let j = 0; j < directions.length; j++) {
      if (allDirections[i].equals(directions[j])){
        isItThere = true;
      }
    }
    if (isItThere === false) {
      diffDir.push(allDirections[i]);
    }
  }
  //sort the different directions that havent been added by uniqueOtherDirections
  let sortedDiffDir = [];
  for (let k = 0; k < uniqueOtherDirections.length; k++) {
    for (let t = 0; t < diffDir.length; t++) {
      if (uniqueOtherDirections[k].equals(diffDir[t])){
        sortedDiffDir.push(diffDir[t]);
      }

    }
  }

  
  
  
  //add the different directions
  for (let i = 0; i < sortedDiffDir.length; i++){
    directions.push(sortedDiffDir[i])
  }

  //Go through differences one more time in case there are anything missing directions
  let finalDiffDir = [];
  for (let i = 0; i < allDirections.length; i++) {
    let isItThere = false;
    for (let j = 0; j < directions.length; j++) {
      if (allDirections[i].equals(directions[j])){
        isItThere = true;
      }
    }
    if (isItThere === false) {
      finalDiffDir.push(allDirections[i]);
    }
  }
  for (let i = 0; i < finalDiffDir.length; i++){
    directions.push(finalDiffDir[i])
  }
  
  //If the most desired direction is Direction.Still, and there are some enemies nearby, then ship is technically stuck
  //let ship jitter by moving the direction.still back a spot
  /*
  if (avoid === true){
    if (directions[0].equals(Direction.Still)){
      let nearbyShips = search.shipsInRadius(gameMap, ship.owner, ship.position, 2);
      if (nearbyShips.enemy.length > 0) {
        let tempDir = directions[0]
        directions[0] = directions[1];
        directions[1] = tempDir;
      }
    }
  }
  */
  //logging.info(`Ship-${ship.id} at ${ship.position} direction order: ${directions}`);
  return directions;
}

//move away from self
function moveAwayFromSelf(gameMap, ship) {
  let possiblePositions = search.circle(gameMap, ship.position, 1);
  let directions = [];
  for (let i = 0; i <possiblePositions.length; i++) {
    let possibleTile = gameMap.get(possiblePositions[i]);
    if (!possibleTile.isOccupied && !possibleTile.hasStructure) {
      //getUnsafeMoves should return direct move to adjacent tile, and theres only one direction.
      directions.push(gameMap.getUnsafeMoves(ship.position, possiblePositions[i])[0]);
    }
  }
  //can be optimized
  //Add directions that aren't there
  let allDir = Direction.getAllCardinals();
  let diffDir = [];
  for (let i = 0; i < allDir.length; i++) {
    let isItThere = false;
    for (let j = 0; j < directions.length; j++) {
      if (allDir[i].equals(directions[j])){
        isItThere = true;
      }
    }
    if (isItThere === false) {
      diffDir.push(allDir[i]);
    }
  }
  for (let i = 0; i < diffDir.length; i++) {
    directions.push(diffDir[i]);
  }
  return directions;
}

//END Game movement
//Take a look at viable directions
//Go to favorite one
//WE will process these later
function finalMove(gameMap, ship, dropoff, avoid) {
  let directions = viableDirections(gameMap, ship, [dropoff.position], avoid, true);
  return directions;
}

//Whether or not its worth it for ship to attack another ship
//Other ship must have more halite than us by a good deal
//There must be friendlies nearby (to pick up the collision aftermath)
//Search in radius of possible collision location (other ship location), if there are at least 2 friends and and they outnumber enemy, go for it
function worthAttacking(gameMap, ship, oship, ratio = 1.5, requireFriends = true) {
  let possibleCollisonPos = oship.position;
  
  if (ratio === -1) {
    return false;
  }
  
  //attempt to detect where collision will occur;
  //Usually, the first direction is where it will occur. The times when this won't happen is when there are collisions with friendly ships detected, of which this will be off a little.
  let collisionDirections = gameMap.getUnsafeMoves(ship.position, oship.position);
  if (collisionDirections.length > 0) {
    possibleCollisonPos = ship.position.directionalOffset(collisionDirections[0]);
  }
  
  //if possible collision Position is over enemy structure, dont do it
  
  let thatStructure = gameMap.get(possibleCollisonPos).structure;
  if (thatStructure !== null && thatStructure.owner !== ship.owner) {
    return false;
  }
  //if absoluteWorth is true, we attack otehrship if we get an absolute advantage in terms of net halite,used for final return
  
  if(ratio * ship.haliteAmount < oship.haliteAmount) {
    if (requireFriends === false) {
      return true;
    }
    let shipsNearby = search.shipsInRadius(gameMap, ship.owner, possibleCollisonPos, 2);
    let friendlyNearby = shipsNearby.friendly.length;
    
    let haliteCargoSpace = 0;
    for (let k = 0; k < shipsNearby.friendly.length; k++) {
      if (shipsNearby.friendly[k].id !== ship.id){
        haliteCargoSpace += (1000 - shipsNearby.friendly[k].haliteAmount);
      }
    }
    let numberOfEnemiesWithSpace = shipsNearby.enemy.length;
    for (let k = 0; k < shipsNearby.enemy.length; k++) {
      if (shipsNearby.enemy[k].haliteAmount >= 900) {
        numberOfEnemiesWithSpace -= 1;
      }
    }
    //logging.info(`Ship-${ship.id} has ${haliteCargoSpace} space in nearby ships`);
    if (friendlyNearby >= 2 && friendlyNearby > shipsNearby.enemy.length && oship.haliteAmount <= haliteCargoSpace){
      logging.info(`Ship-${ship.id} is going to try to collide with at least 2 other friends nearby f:${shipsNearby.friendly.length}, e:${shipsNearby.enemy.length}, e with space:${numberOfEnemiesWithSpace} at ${possibleCollisonPos}`)
      return true;
    }
  }
  return false;
  
}

function returnShip(gameMap, player, ship, ships) {
  //not optimized, could be optimized by storing the nearest dropoff for now, and only finding a new nearest dropoff if there is a new dropoff built
  let nearestDropoff = search.findNearestDropoff(gameMap, player, ship.position);
  let id = ship.id;
  ships[id].targetDestination = nearestDropoff.position;
  //Last two arguments of below are true, false = avoid and dont attack
  let distanceToNearestDropoffWhenReturning = gameMap.calculateDistance(ship.position, nearestDropoff.position);
  let avoidEnemy = true;
  //allow enemy collison if 1 away from own dropoff
  if (distanceToNearestDropoffWhenReturning <= 1){
    avoidEnemy = false;
  }
  //or if unit is 2 away from dropoff but there is an enemy on top of the dropoff
  let oship = gameMap.get(nearestDropoff.position).ship;
  if (distanceToNearestDropoffWhenReturning <= 2 && oship !== null && oship.owner !== ship.owner){
    avoidEnemy = false;
  }
  let directions = viableDirections(gameMap, ship, [ships[id].targetDestination], avoidEnemy);
  return directions;
}

//returns positions and directions that do not conflict with the given shipDesired positions and shipdirections
function findNonConflictingMoves(gameMap, ship, shipDesiredPositions1, shipDirections1, spawnedIds) {
  let k = 0;
  let id = ship.id;
  let nonConflictDesiredPositions = [];
  let nonConflictDirections = [];
  let conflictingDirectionsAndId = [];
  let conflictingPositionsAndId = [];
  let otherShipPositions = search.circle(gameMap, ship.position, 2);
  let otherIds = [];
  for (let p = 0; p < spawnedIds.length; p++) {
    otherIds.push(spawnedIds[p]);
  }
  for (let p = 1; p < otherShipPositions.length; p++) {
    let oship = gameMap.get(otherShipPositions[p]).ship;
    //find other ships I own
    if (oship !== null && oship.owner === ship.owner) {
      //if (shipDesiredPositions1[otherId][0].equals(checkPos)){
      otherIds.push(oship.id);
    }
  }
  for (k = 0; k < shipDesiredPositions1[id].length; k++) {
    let checkPos = shipDesiredPositions1[id][k];
    let existConflict = false;
    for (let otherId of otherIds) {

      if (shipDesiredPositions1[otherId] !== undefined) {
        //logging.info(`PANIC: temp position: ${shipDesiredPositions1[otherId]} for Ship-${otherId}`);
        if (shipDesiredPositions1[otherId][0].equals(checkPos)) {
          existConflict = true;
          conflictingDirectionsAndId.push({direction: shipDirections1[id][k], id: otherId});
          conflictingPositionsAndId.push({position: checkPos, id: otherId});
          break; //break as there is an conflict
        }
      }
    }
    if (existConflict === false) {
      //All directions and positions without conflict get pushed here.
      //the indexes correspond with each other in shipDirections1 and shipDesiredPositions1
      nonConflictDirections.push(shipDirections1[id][k]);
      nonConflictDesiredPositions.push(shipDesiredPositions1[id][k]);
    }
  }
  return {directions: nonConflictDirections, positions: nonConflictDesiredPositions, conflictPositionsAndId: conflictingPositionsAndId, conflictDirectionsAndId: conflictingDirectionsAndId};
}

module.exports = {
  canMove,
  viableDirections,
  finalMove,
  moveAwayFromSelf,
  worthAttacking,
  returnShip,
  findNonConflictingMoves,
}