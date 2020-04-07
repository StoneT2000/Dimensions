import * as Dimension from '../src';
import { Match } from '../lib';

// Test design for Domination Game
// Basic overview
// 1. Each team starts off with a single cell labelled their team number (0,1,...)
// 2. Each team chooses to expand towards a cell that is not owned by another team
//    that is adjacent to a cell they own already
// 3. If two or more teams expand towards the same cell, that cell is removed of ownership
// 4. Winner is whoever controls the most cells

// Good practices for making new AI designs easy. 
// 1. Apply functional programming when dealing with anything with the match
// 2. Only edit AgentControls and Design
// Specifics
// At initialization
// 1. Send any global state variables
// 2. Send each agent their own ID for reference
// At update
// Two methods: Send entire state, or just send updates that change the state
// Regardless, recommended to send each agent the number of lines of input they are about to receive if this is a
// dynamic amount of lines

export class DominationDesign extends Dimension.Design {
  constructor(name) {
    super(name);
  }
  async initialize(match: Match, config?: any) {
    
    let state = {
      size: config.size,
      map: [],
      round: 1,
      MAX_ROUNDS: config.maxRounds
    };

    match.log.info('Initial state', state);

    // can access the config through input config or directly from match
    for (let i = 0; i < match.configs.initializeConfig.size; i++) {
      state.map.push([]);
      for (let j = 0; j < config.size; j++) {
        state.map[i].push(-1);
      }
    }
    // store the state into the match so it can be used again in `update` and `storeResults`
    match.state = state;
    // if there are 2 players, start them off in opposite corners
    if (match.agents.length == 2) {
      state.map[0][0] = match.agents[0].id;
      state.map[config.size - 1][config.size - 1] = match.agents[1].id;
    }
    // otherwise fill the first row with the agents
    else {
      match.agents.forEach((agent) => {
        state.map[0][agent.id] = agent.id;
      });
    }

    // Send each agent their ID so they can find themselves on the map
    for (let i = 0; i < match.agents.length; i++) {
      await match.send(`${match.agents[i].id}`, match.agents[i].id);
    }

    // Send each agent the map size
    await match.sendAll(`${match.state.size}`);

    // Now send each agent row by row the map configuration
    for (let i = 0; i < match.state.size; i++) {
      let rowData = '';
      for (let j = 0; j < match.state.size; j++) {
        rowData += state.map[i][j] + ',';
      }
      await match.sendAll(rowData);
    }
    
  }

  async update(match: Match, commands: Array<Dimension.Command>) {
    match.log.infobar();
    match.log.info("Round - " + (match.state.round));
    match.log.info("Updating state");

    let updatedTileSet = new Set();
    let updates = [];
    let commandsRanThisround = {};
    match.agents.forEach((agent) => {
      commandsRanThisround[agent.id] = 0;
    })
    const expand = (agentID: number, x: number, y: number) => {
      if (!inMap(x,y)) {
        match.throw(agentID, new Dimension.MatchError(`(${x}, ${y}) is out of bounds`))
        return;
      }
      if (match.state.map[y][x] !== -1 && match.state.map[y][x] != agentID) {
        match.throw(agentID, new Dimension.MatchError(`(${x}, ${y}) is not empty nor owned by agent`))
        return;
      }
      let neighbors = getNeighbors(x,y);
      let adjacent = false;
      for (let i = 0; i < neighbors.length; i++) {
        let coords = neighbors[i];
        if (inMap(coords[0], coords[1]) && match.state.map[coords[1]][coords[0]] === agentID) {
          adjacent = true;
          break;
        }
      }
      if (!adjacent) {
        match.throw(agentID, new Dimension.MatchError(`(${x}, ${y}) is not adjacent to an owned tile`));
        return;
      }


      if (updatedTileSet.has(hashCoords(x, y))) {
        // if this map tile was just owned by another player this round, then this counts as collision and no one
        // gets the tile it is removed
        updates.push([x,y,-1]);
      }
      else {
        updatedTileSet.add(hashCoords(x, y));
        updates.push([x,y,agentID]);
      }
      commandsRanThisround[agentID]++;
    }
    const getNeighbors = (x: number, y: number) => {
      return [[x-1, y], [x, y-1], [x, y], [x, y+1], [x+1, y]];
    }
    const inMap = (x, y): boolean => {
      if (x >= match.state.size || y >= match.state.size || x < 0 || y < 0) {
        return false;
      }
      return true;
    }

    const hashCoords = (x, y) => {
      return y * match.state.size + x;
    }
    const parseHash = (hash) => {
      hash = parseInt(hash);
      return [hash % match.state.size, Math.floor(hash / match.state.size)]
    }

    // filter commands and sort them accordingly?
    // the order in which commands / output from agents stream into the match engine can be configured when initializing the Design

    
    for (let i = 0; i < commands.length; i++) {
      let cmd = commands[i].command;
      let id = commands[i].agentID;
      switch (cmd[0]) {
        case "e":
          if (commandsRanThisround[id] >= 1) {
            match.throw(id, new Dimension.MatchError('Past command limit!'));
            break;
          }
          let x = parseInt(cmd.slice(1,3));
          let y = parseInt(cmd.slice(3,5));

          // try expanding at x y for this Agent
          expand(id, x, y);
          break;
      }
    }
    match.sendAll(updates.length);
    updates.forEach((update) => {
      // send the updated ownership of cell at x=update[0], y=update[1]
      match.sendAll(`${update[0]},${update[1]},${update[2]}`);
      match.state.map[update[1]][update[0]] = update[2];
    })

    match.log.info('End of Round ' + (match.state.round));
    
    if (match.state.round === match.state.MAX_ROUNDS) {
      return Dimension.MatchStatus.FINISHED;
    }
    match.state.round++;
    
  }

  async getResults(match: Dimension.Match) {
    let results = {
      scores: {},
      winner: '',
      winningScore: 0,
      finalMap: match.state.map
    };

    match.agents.forEach((agent) => {
      results.scores[agent.id] = 0;
    })

    // we count score by adding up the number of tiles an agent owns
    // We know that each tile is given a number equal to the owning agent's id
    for (let i = 0 ; i < match.state.map.length; i++) {
      for (let j = 0 ; j < match.state.map.length; j++) {
        let cell = match.state.map[i][j];
        if (cell !== -1) {
          results.scores[cell]++;
        }
      }
    }

    // now find the winner by picking out the highest scorer
    let highestScoringAgent;
    let highestScore = -1;
    for (const agentID in results.scores) {
      
      if (results.scores[agentID] > highestScore) {
        let agent = match.idToAgentsMap.get(parseInt(agentID));
        highestScore = results.scores[agentID]
        highestScoringAgent = agent;
      }
    }
    results.winner = highestScoringAgent.name;
    results.winningScore = highestScore;
    
    return results;
  }

  
}