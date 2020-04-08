import { ChildProcess, exec, spawn } from "child_process";
import path from 'path';
import fs from 'fs';
import { Logger } from "../Logger";
import { FatalError } from "../DimensionError";
import { Tournament } from "../Tournament";

export enum AgentStatus {
  UNINITIALIZED = 'uninitialized', // just created agent
  READY = 'ready', // agent that has been fully created and ready to be used by the engine for a match
  RUNNING = 'running', // agent that has a process running with it now
  CRASHED = 'crashed',
  KILLED = 'killed', // agent that has finished and is killed or was prematurely killed
  STOPPED = 'stpped' // agent is currently not running
}
export type agentID = number;

/**
 * @class Agent
 * @classdesc Reads in a file source for the code and creates an `Agent` for use in the `MatchEngine` and `Match`
 * 
 */
export class Agent {
  
  public id: agentID = 0; // id used within a match
  public tournamentID: Tournament.ID = null; // a tournmanet ID if used within a tournament
  public name: string; // name of this agent
  public src: string; // path to file to run
  public ext: string;
  public cwd: string; // current working directory of agent
  public cmd: string; // command used to run file

  public _buffer: Array<string> = []; // internal buffer to store stdout from an agent that has yet to be delimited / used

  process: ChildProcess = null;

  // current status of the agent
  public status: AgentStatus = AgentStatus.UNINITIALIZED;

  public currentMoveCommands: Array<string> = [];

  public creationDate: Date;
  // a promise that resolves when the Agent's current move in the `Match` is finished
  public currentMovePromise: Promise<void>;
  public currentMoveResolve: Function = () => {}; // set as a dummy function
  public currentMoveReject: Function;

  public agentTimeStep = 0;

  public clearTimer: Function = () => {};

  private log = new Logger();

  // whether agent is allowed to send commands. Used to help ignore extra output from agents
  private allowedToSendCommands = true;
  private terminated = false;
  
  constructor(file: string, options: any) {
    this.creationDate = new Date();

    this.ext = path.extname(file);
    switch(this.ext) {
      case '.py':
        this.cmd = 'python'
        break;
      case '.js':
        this.cmd = 'node'
        break;
      case '.java':
        this.cmd = 'java'
      default:
        // throw new DimensionError(`${ext} is not a valid file type`);
    }
    let pathparts = file.split('/');
    this.cwd = pathparts.slice(0, -1).join('/');
    this.src = pathparts.slice(-1).join('/');

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
    if (options.tournamentID) {
      this.tournamentID = options.tournamentID;
      this.name = this.tournamentID.name;
    }
    

    this.log.level = options.loggingLevel;

    this.log.system(`Created agent: ${this.name}`);

    // set agent as ready
    this.status = AgentStatus.READY;

  }


  /**
   * Compile whatever is needed
   */
  async _compile(): Promise<void> {
    return new Promise((resolve, reject) => {
      switch(this.ext) {
        case '.py':
          resolve();
          break;
        case '.js':
          resolve();
          break;
        case '.java':
          exec("javac " + this.src, {
            cwd: this.cwd
          }, (err) => {
            if (err) reject(err);
            resolve();
          })
          break;
        default:
          reject('Unrecognized file');
      }
    });
  }

  /**
   * Spawn the process and return the process
   */
  async _spawn(): Promise<ChildProcess> {
    return new Promise((resolve, reject) => {
      let p;
      switch(this.ext) {
        case '.py':
        case '.js':
          p = spawn(this.cmd, [this.src], {
            cwd: this.cwd
          }).on('error', function( err ){ reject(err) });
          resolve(p);
          break;
        case '.java':
          let src = this.src.slice(0, -5);
          p = spawn(this.cmd, [src], {
            cwd: this.cwd
          }).on('error', function( err ){ reject(err) });
          resolve(p);
          break;
        case '.c':
        case '.cpp':
          break;
        default:
          reject('Unrecognized file');
      }
    })
  }


  isTerminated() {
    return this.status === AgentStatus.KILLED;
  }
  _terminate() {
    this.status = AgentStatus.KILLED;
  }

  _disallowCommands() {
    this.allowedToSendCommands = false;
  }
  _allowCommands() {
    this.allowedToSendCommands = true;
  }
  getAllowedToSendCommands() {
    return this.allowedToSendCommands;
  }

  setTimeout(fn, delay, ...args) {
    let timer = setTimeout(() => {
      fn(...args);
    }, delay);
    this.clearTimer = () => {
      clearTimeout(timer);
    }
  }

  /**
   * Stop this agent from more outputs and mark it as done for now and awaiting for updates
   */
  finishMove() {
    this.clearTimer();
    // Resolve move and tell engine in `getCommands` this agent is done outputting commands and awaits input
    this.currentMoveResolve();
            
    // stop the process for now from sending more output and disallow commmands to ignore rest of output
    this.process.kill('SIGSTOP');
    this._disallowCommands();
  }

  // Start an Agent's move and setup the promise structures
  _setupMove() {
    // allow agent to send commands, increment time, clear past commands, and reset the promise
    this.allowedToSendCommands = true;
    this.agentTimeStep++;
    this.currentMoveCommands = [];
    this.currentMovePromise = new Promise((resolve, reject) => {
      this.currentMoveResolve = resolve;
      this.currentMoveReject = reject;
    });
  }

  /**
   * Generates a list of agents for use
   * @param files List of files to use to make agents or a list of objects with a file key for the file path to the bot 
   *              and a name key for the name of the agent
   * @param loggingLevel - the logging level for all these agents
   */
  static generateAgents(files: Array<String> | Array<{file: string, name: string}> | Array<{file: string, tournamentID: Tournament.ID}>, loggingLevel: Logger.LEVEL): Array<Agent> {
    if (files.length === 0) {
      throw new FatalError('No files provided to generate agents with!');
    }
    let agents: Array<Agent> = [];

    if (typeof files[0] === 'string') {
      files.forEach((file, index) => {
        agents.push(new Agent(file, {id: index, name: null, loggingLevel: loggingLevel}))
      })
    }
    //@ts-ignore
    else if (files[0].name !== undefined) {
      files.forEach((info, index) => {
        agents.push(new Agent(info.file, {id: index, name: info.name, loggingLevel: loggingLevel}))
      })
    }
    else {
      files.forEach((info, index) => {
        agents.push(new Agent(info.file, {id: index, tournamentID: info.tournamentID, loggingLevel: loggingLevel}))
      })
    }
    return agents;
  }
}