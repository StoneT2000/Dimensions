#!/usr/bin/env node

const readline = require('readline');

class Agent {
  _setup() {
    // Prepare to read input
    const rl = readline.createInterface({
      input: process.stdin,
      output: null,
    });

    let buffer = [];
    let currentResolve;
    const makePromise = function () {
      return new Promise((resolve) => {
        currentResolve = resolve;
      });
    };
    // on each line, push line to buffer
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
        resolve((buffer.shift()));
      });
    };
    this.getLine = getLine;
  }

  /**
   * Constructor for a new agent
   */
  constructor() {
    this._setup(); // DO NOT REMOVE
    this.meta = {}
  }

  /**
   * Produce an action given the observation
   * @param obs
   * @returns
   */
  act(obs) {
    return 1;
  }
}

const agent = new Agent();
(async () =>{
  while (true) {
    const data = JSON.parse(await agent.getLine());
    const input_type = data['type'];
    const output = (d) => console.log(JSON.stringify(d));
    if (input_type == 'init') {
      agent.meta['id'] = data['id'];
      agent.meta['name'] =  data['name'];
      output({ id: agent.meta['id'] });
    } else if (input_type == 'action') {
      // if "reward" not in data:
      //     # then this is a new episode!
      //     pass
      output({ action: agent.act(data['obs']) });
    } else if (input_type == 'close') {
      // do any kind of clean up you want to do
      // exit();
    }
  }
  
})();