const hlt = require('./../hlt');
const { Direction, Position } = require('./../hlt/positionals');
const search = require('./search.js')
const logging = require('./../hlt/logging')
const movement = require('./movement.js')
let extractPercent = 0.25//1/hlt.constants.EXTRACT_RATIO;
let moveCostPercent = 0.1//1/hlt.constants.MOVE_COST_RATIO;

//Heuristic of this mining code
//Go to another space if the halite there > (distanceToThere + 1)*haliteHere

//The halitehere and halitethere is calculated by taking the halite amount at the position. 
//We add an extra 200% to that amount if the distance is within one unit of current position and there is inspiration available
function nextMiningPosition(gameMap, player, ship, range){
  let omp = ship.position;
  let sortedPositionsAndRates = [];
  let sortedPositions = [];
  let possiblePositions = search.circle(gameMap, ship.position, range);
  
  let inspiredHere = inspirationHere(gameMap, player, ship.position);
  
  let haliteHere = gameMap.get(ship.position).haliteAmount;  
  
  //look 5 turns ahead
  let haliteRateHereMax = -9999999;
  
  let turnsAhead = 4;
  
  let origNearestDropoffAndDist = search.findNearestDropoff(gameMap, player, ship.position, true);
  let kt = 0;
  let ghx = 0;
  for (let i = 1; i <= turnsAhead; i++){
    //let mine for i turns
    let haliteMinedHere = halitePotential(gameMap, ship.position, i, haliteHere);
    let haliteGainedHere = haliteMinedHere;
    
    if (inspiredHere) {
      haliteGainedHere = haliteMinedHere * 3;
    }

    if (haliteGainedHere + ship.haliteAmount > 1000) {
      //can only gain this much
      haliteGainedHere = 1000 - ship.haliteAmount;
      //can only mine this much then
      //when there is inspiration or not, we first add how much the ship actually mined out, then give the bonus
      if (haliteGainedHere < haliteMinedHere) {
        haliteMinedHere = haliteGainedHere;
      }
      
    }
    let haliteLeftHere = gameMap.get(ship.position).haliteAmount - haliteMinedHere;

    
    let origCostBackToDropoff = costToMoveThere(gameMap, ship.position, origNearestDropoffAndDist.nearest.position, haliteLeftHere);
    //haliteHere -= origCostBackToDropoff;
    let turnsSpent = origNearestDropoffAndDist.distance + i;
    let haliteRateHere = (haliteMinedHere - origCostBackToDropoff)/(turnsSpent);
    if (haliteRateHere > haliteRateHereMax) {
      haliteRateHereMax = haliteRateHere;
      kt = i;
      ghx = haliteGainedHere;
      
    }
    //logging.info(`Ship-${ship.id} rate:${haliteRateHere.toFixed(2)} at ${ship.position} for ${i} mining turns gain ${haliteGainedHere}`);
    
  }
  //logging.info(`Ship-${ship.id} rate:${haliteRateHereMax.toFixed(2)} at ${ship.position} for ${kt} mining turns gain ${ghx}`);
  sortedPositionsAndRates.push({position:ship.position, rate: haliteRateHereMax});
  
  for (let i = 0; i < possiblePositions.length; i++) {
    let pos = possiblePositions[i]; //possible position
    let gameTile = gameMap.get(pos); //possible game tile
    
    if (!gameTile.isOccupied && !gameTile.hasStructure){
      let distanceToPos = gameMap.calculateDistance(ship.position, pos);
      let inspiredThere = false;
      //we add inspiration only if considering nearby positions
      if (distanceToPos <= 1) {
        inspiredThere = inspirationHere(gameMap, player, pos);
      }
      
      
      let nearestDropoffAndDist = search.findNearestDropoff(gameMap, player, pos, true);
      let nearestDropoff = nearestDropoffAndDist.nearest;
      let distanceToDropoff = nearestDropoffAndDist.distance;
      let costToPos = costToMoveThere(gameMap, ship.position, pos);
      
      let cargoThere = ship.haliteAmount - costToPos
      
      //check only positions where we can reach in that time
      if (true){
        let turnPadding = 0;
        if (cargoThere <= 0) {
          //cargoThere = 0;
          //logging.info(`Not enough halite to reach there`)
          turnPadding = 0;
        }
        let haliteThere = gameMap.get(pos).haliteAmount;
        let mineTurns = 0;
        let haliteGainedThereMax = 0;
        let haliteRateThereMax = -9999999;
        for (let i = 1; i <= turnsAhead; i++){
          let turnsSpent = distanceToDropoff + distanceToPos + i + turnPadding;
          //mine for i turns
          let haliteMinedThere = halitePotential(gameMap, pos, i, haliteThere);
          let haliteGainedThere = haliteMinedThere;
          if (inspiredThere) {
            haliteGainedThere = haliteMinedThere * 3; //a little unaccuate as the 200% added is added to the rounded up mining amount
          }

          if (haliteGainedThere + cargoThere > 1000) {
            haliteGainedThere = 1000 - cargoThere;
            if (haliteGainedThere < haliteMinedThere) {
              haliteMinedThere = haliteGainedThere;
            }
          }

          let haliteLeftThere = gameMap.get(pos).haliteAmount - haliteMinedThere;

          let costBackToDropoff = costToMoveThere(gameMap, pos, nearestDropoff.position, haliteLeftThere);

          let haliteRateThere = (haliteGainedThere - costToPos - costBackToDropoff)/ (turnsSpent);
          if (haliteRateThere > haliteRateThereMax) {
            haliteRateThereMax = haliteRateThere;
            haliteGainedThereMax = haliteGainedThere;
            mineTurns = i;
          }
          
          //logging.info(`Ship-${ship.id} rate:${haliteRateThere.toFixed(2)} at ${pos} for ${i} mining turns gain ${haliteGainedThere}`);
        }
        //logging.info(`Ship-${ship.id} rate:${haliteRateThereMax.toFixed(2)} at ${pos} for ${mineTurns} mining turns gain ${haliteGainedThereMax}`);
        sortedPositionsAndRates.push({position:pos, rate:haliteRateThereMax});
      }

    }
  }
  sortedPositionsAndRates.sort(function(a,b){
    return b.rate - a.rate;
  });
  sortedPositions = sortedPositionsAndRates.map(function(a){return a.position});
  //logging.info(`Ship-${ship.id} halite at ${omp}: ${gameMap.get(omp).haliteAmount} is ${gameMap.calculateDistance(ship.position, omp)} away, haliteHere:${haliteHere}`);
  //logging.info(`Ship-${ship.id} best rate:${sortedPositionsAndRates[0].rate.toFixed(2)} at ${sortedPositions[0]}`);
  return sortedPositions;
}

//Determine halite gained in these turns at this position if mining for turns: turns, optionally given the halitebelow
function halitePotential(gameMap, position, turns, haliteBelow) {
  let haliteHere = gameMap.get(position).haliteAmount;
  if (haliteBelow) {
    haliteHere = haliteBelow;
  }
  if (haliteBelow <= 0) {
    return gameMap.get(position).haliteAmount;
  }
  if (turns === 0) {
    return gameMap.get(position).haliteAmount - haliteHere;
  }
  return halitePotential(gameMap, position, turns-1, haliteHere - Math.ceil(haliteHere*0.25));
}

//Find amount of halite in surrounding area of position: position with radius: radius
function totalHaliteInRadius(gameMap, position, radius) {
  let positions = search.circle(gameMap, position, radius);
  let totalHalite = 0;
  for (let i = 0; i < positions.length; i++) {
    totalHalite += gameMap.get(positions[i]).haliteAmount;
  }
  return totalHalite;
}

//The cost to move from startPos to targetPos, optinally given a changed amount of halite below the startPos
function costToMoveThere(gameMap, startPos, targetPos, haliteBelow){
  //logging.info(`Ship-${ship.id}:Calculating totalhalitecost`);
  let currentPosition = startPos;
  
  //If ship is on target position, no halite cost to move there
  if (currentPosition.equals(targetPos)){
    return 0;
  }
  
  let totalHaliteCost = Math.floor(gameMap.get(currentPosition).haliteAmount * moveCostPercent);
  
  //use the argument haliteBelow to predict future costs. Supposing that the halite below is going to be different than what it is now due to mining
  if (haliteBelow) {
    //logging.info(`Ship-${ship.id} halitebelow given`);
    totalHaliteCost = Math.floor(haliteBelow * moveCostPercent);
  }
  
  

  //while the current ghost position isn't the target, find the next move the ship would take and add to cost
  //!currentPosition.equals(targetPos)
  let k = 0;
  while (!currentPosition.equals(targetPos)) {
    //We ignore enemy ships when calculating this
    let directionsToThere = gameMap.getUnsafeMoves(currentPosition, targetPos);
    if (directionsToThere.length >=2 ) {
      let halite1 = (gameMap.get(currentPosition.directionalOffset(directionsToThere[0]))).haliteAmount;
      let halite2 = (gameMap.get(currentPosition.directionalOffset(directionsToThere[1]))).haliteAmount;
      if (halite2 < halite1) {
        directionsToThere[0] = directionsToThere[1];
      }
    }
    //for some reason using viableDirections with avoiding set to false results in crashes, communication failed. I'm thinking its an infinite while loop but it if it was, the log below would constantly be logging but it isn't.
    //let directionsToThere = movement.viableDirections(gameMap, ship, targetPos, false)
    //logging.info(`${ship.id}: ${directionsToThere}`)
    if (k !== 0) {
      totalHaliteCost += Math.floor(gameMap.get(currentPosition).haliteAmount * moveCostPercent);
    }
    currentPosition = gameMap.normalize(currentPosition.directionalOffset(directionsToThere[0]));
    k++;
    
    //logging.info(`Ship-${ship.id}: Directions: ${directionsToThere}`);
  }
  return totalHaliteCost;
  
  
}

//Number of turns before the ship is filled to 1000
//Returns number of turns to overfill if ship overfills, false if it doesn't overfill
function turnsToOverfill(gameMap, currentHalite, pos, haliteBelow, turnNum) {
  let startingHalite = gameMap.get(pos);
  if (haliteBelow) {
    startingHalite = haliteBelow;
  }
  if (startingHalite === 0) {
    return false;
  }
  let turnCount = turnNum += 1;
  let extracted = Math.ceil(startingHalite * extractPercent);
  if (currentHalite + extracted >= 1000) {
    return turnCount;
  }
  return turnsToOverfill(gameMap, currentHalite+extracted, pos, startingHalite - extracted, turnCount);
}

//Return true/false if a player's ship at this position would be inspired or not
function inspirationHere(gameMap, player, position) {
  //note, if player isn't myself and is another player, we can check if the enemy would be inspired or not.
  
  let searchPositions = search.circle(gameMap, position, 4);
  
  //we could jsut use the function from search.js that tells us how many enemy ships are in radius, but rewriting it with a break statement is more efficient.
  let enemyShips = 0;
  for (let i = 0; i < searchPositions.length; i++) {
    let tile = gameMap.get(searchPositions[i]);
    let oship = tile.ship;
    //enemy ship on this tile
    if (oship !== null && oship.owner !== player.shipyard.owner) {
      enemyShips += 1;
      if (enemyShips >= 2) {
        break;
      }
    }
  }
  if (enemyShips >=2) {
    return true;
  }
  else {
    return false;
  }
}

module.exports = {
  extractPercent,
  moveCostPercent,
  totalHaliteInRadius,
  costToMoveThere,
  nextMiningPosition,
}