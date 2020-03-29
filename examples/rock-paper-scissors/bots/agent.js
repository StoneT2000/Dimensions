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
  }

  /**
   * Initialize Agent for the `Match`
   * User should edit this according to their `Design`
   */
  async initialize() {

    // use (await this.getLine()) to get a parsed line of commands from the match engine
    // This parsed line is an object from which you can get the nextInt, nextFloat, nextIntArr etc..
    let myAgentID = (await this.getLine()).nextInt();
    this.id = myAgentID;

    let maxRounds = (await this.getLine()).nextInt();
    this.maxRounds = maxRounds;
    // Let's also store the opponents moves and the results of each round after each round
    this.pastOpponentMoves = [];
    this.roundResults = [];

    // Rock paper scissors is pretty simple, not much needed to initialize
  }
  /**
   * Updates agent's own known state of `Match`. In Rock Paper Scissors, we update this agent's knowledge of opponent's
   * moves
   */
  async update() {

    // wait for the engine to send the result of the last round, which is the ID of the agent who won
    let result = (await this.getLine()).nextInt();
    this.roundResults.push(result);

    // wait for the engine to send you the opponent's last move, which is either 'R', 'P', or 'S'
    let lastOpponentMove = (await this.getLine()).nextStr();
    this.pastOpponentMoves.push(lastOpponentMove);
  }

  endTurn() {
    console.log('D_FINISH');
  }
}

module.exports = AgentControl;