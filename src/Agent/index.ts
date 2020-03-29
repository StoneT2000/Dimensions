import { DimensionError, Logger, LoggerLEVEL, FatalError } from "..";
import { ChildProcess } from "child_process";

const fs = require('fs');

export type agentID = number;
/**
 * @class Agent
 * @classdesc Reads in a file source for the code and creates an `Agent` for use in the `MatchEngine` and `Match`
 */
export class Agent {
  
  public id: agentID = 0;
  public name: string; // name of this agent
  public src: string; // source to file to run or URI to use
  public cmd: string; // command used to run file

  public process: ChildProcess = null;

  public currentMoveCommands: Array<string> = [];

  // a promise that resolves when the Agent's current move in the `Match` is finished
  public currentMovePromise: Promise<void>;
  public currentMoveResolve: Function;
  public currentMoveReject: Function;

  public agentTimeStep = 0;

  private log = new Logger();
  
  constructor(file: string, options: any) {
    this.src = file;
    let ext = this.src.slice(-3);
    switch(ext) {
      case '.py':
        this.cmd = 'python'
        break;
      case '.js':
        this.cmd = 'node'
        break;
      default:
        // throw new DimensionError(`${ext} is not a valid file type`);
    }

    // check if file exists
    if(!fs.existsSync(file)) {
      throw new FatalError(`${file} does not exist, check if file path provided is correct`);
    }

    if (options.command) {
      this.cmd = options.command;
    } else if (!this.cmd) {
      throw new FatalError(`No command provided or inferable for agent using ${file}`);
    }
    if (options.id !== undefined) {
      this.id = options.id;
    } else {
      throw new FatalError(`No id provided for agent using ${file}`);
    }
    if (options.name) {
      this.name = options.name;
    }
    else {
      this.name = `agent_${this.id}`;
    }
    

    this.log.level = options.loggingLevel;

    this.log.system(`Created agent: ${this.name}`);

  }

  // Start an Agent's move and setup the promise structures
  _setupMove() {
    // continue agent again
    this.process.kill('SIGCONT');
    this.agentTimeStep++;
    this.currentMoveCommands = [];
    this.currentMovePromise = new Promise((resolve, reject) => {
      this.currentMoveResolve = resolve;
      this.currentMoveReject = reject;
    });
  }

  /**
   * Generates a list of agents for use
   * @param files List of files to use to make agents
   * @param names List of optional names for each agent, if empty, defaults to default agent names
   */
  static generateAgents(files: Array<String> | Array<{file: string, name: string}>, loggingLevel: LoggerLEVEL): Array<Agent> {
    let agents: Array<Agent> = [];

    if (typeof files[0] === 'string') {
      files.forEach((file, index) => {
        agents.push(new Agent(file, {id: index, name: undefined, loggingLevel: loggingLevel}))
      })
    }
    else {
      files.forEach((info, index) => {
        agents.push(new Agent(info.file, {id: index, name: info.name, loggingLevel: loggingLevel}))
      })
    }

  
    return agents;
  }
}