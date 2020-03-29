const fs = require('fs');
const readline = require('readline');

// Create parser and use ',' as the delimiter
const Parser = require('./parser');
const parse = new Parser(',');

/**
 * Agent Control for sequential `Designs`
 */
class AgentControl {
  _setup() {
// code for readline and getline taken from Halite 3 JS starter kit

    // Prepare to read input
    const rl = readline.createInterface({
      input: process.stdin,
      output: null,
    });

    let buffer = [];
    let currentResolve;
    const makePromise = function() {
      return new Promise((resolve) => {
        currentResolve = resolve;
      });
    };
    // on each line, push line to buffer
    // 
    rl.on('line', (line) => {
      buffer.push(line);
      currentResolve();
      currentPromise = makePromise();
    });

    // The current promise for retrieving the next line
    let currentPromise = makePromise();
    
    // with await, we pause process until there is input
    const getLine = async () => {
      return new Promise(async (resolve) => {
        while (buffer.length === 0) {
          // pause while buffer is empty, continue if new line read
          await currentPromise;
        }
        // once buffer is not empty, resolve the most recent line in stdin, and remove it
        resolve(parse(buffer.shift()));
      });
    };
    this.getLine = getLine;
  }
  constructor() {
    this._setup();
    this.map = [];
  }

  /**
   * Initialize Agent for the `Match`
   * User should edit this according to their `Design`
   */
  async initialize() {
    // get the first line to get the game of life map size
    let myAgentID = (await this.getLine()).nextInt();
    this.id = myAgentID;
    // console.log(`My ID: ${this.id}`);
    let size = (await this.getLine()).nextInt();
    // console.log(`Map size: ${size}`);

    // now getLine size times to get the full map board
    let map = [];
    for (let i = 0; i < size; i++) {
      let row = (await this.getLine()).nextIntArr();
      this.map.push(row);
    }
    // console.log(`Initial Map: ${JSON.stringify(this.map)}`);
  }
  /**
   * Updates agent's own known state of `Match`
   */
  async update() {
    let updateCount = (await this.getLine()).nextInt();
    for (let i = 0; i < updateCount; i++) {
      let update = (await this.getLine()).nextIntArr();
      this.map[update[1]][update[0]] = update[2];
    }
  }

  endTurn() {
    console.log('D_FINISH');
  }
}

module.exports = AgentControl;