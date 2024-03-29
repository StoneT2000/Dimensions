import readline from 'readline';

// Create parser and use ',' as the delimiter between commands being sent by the `Match` and `MatchEngine`
import { parse, Parsed } from './parser';
const DELIMITER = ',';

/**
 * Agent for sequential `Designs`
 */
export class Agent {
  public getLine: () => Promise<Parsed>;
  public id: number;
  public roundResults: Array<number> = [];
  _setup(): void {
    // Prepare to read input
    const rl = readline.createInterface({
      input: process.stdin,
      output: null,
    });

    const buffer = [];
    let currentResolve: Function;
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
    const getLine = async (): Promise<Parsed> => {
      return new Promise(async (resolve) => {
        while (buffer.length === 0) {
          // pause while buffer is empty, continue if new line read
          await currentPromise;
        }
        // once buffer is not empty, resolve the most recent line in stdin, and remove it
        resolve(parse(buffer.shift(), DELIMITER));
      });
    };
    this.getLine = getLine;
  }

  /**
   * Constructor for a new agent
   * User should edit this according to the `Design` this agent will compete under
   */
  constructor() {
    this._setup(); // DO NOT REMOVE
  }

  /**
   * Initialize Agent for the `Match`
   * User should edit this according to their `Design`
   */
  async initialize(): Promise<void> {
    // use (await this.getLine()) to get a parsed line of commands from the match engine
    // This parsed line is an object from which you can get the nextInt, nextFloat, nextIntArr etc..

    // get agent ID
    this.id = (await this.getLine()).nextInt();
    // get some other necessary initial input
    const maxRounds = (await this.getLine()).nextInt();
  }
  /**
   * Updates agent's own known state of `Match`
   * User should edit this according to their `Design`.
   */
  async update() {
    // wait for the engine to send the result of the last round, which is the ID of the agent who won
    const result = (await this.getLine()).nextInt();
    this.roundResults.push(result);

    // wait for the engine to send you the opponent's last move, which is either 'R', 'P', or 'S'
    const lastOpponentMove = (await this.getLine()).nextStr();
  }

  /**
   * End a turn
   */
  endTurn() {
    console.log('D_FINISH');
  }
}
