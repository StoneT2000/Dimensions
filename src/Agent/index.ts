import { ChildProcess, exec, spawn } from "child_process";
import path from 'path';
import fs from 'fs';
import { Logger } from "../Logger";
import { FatalError } from "../DimensionError";
import { Tournament } from "../Tournament";

/**
 * @class Agent
 * @classdesc The agent is what participates in a match and contains details on the files powering the agent, the
 * process associated and if it is terminated or not.
 * 
 * Reads in a file source for the code and creates an `Agent` for use in the {@link MatchEngine} and {@link Match}
 */
export class Agent {
  
  /**
   * This agent's ID in a match. Is a number
   */
  public id: Agent.ID = 0;
  /**
   * A tournmanet ID if Agent is generated from within a {@link Tournament}
   */
  public tournamentID: Tournament.ID = null;

  /**
   * Name of the agent
   * @default agent_[id]
   */
  public name: string;

  /** The source path to the file that runs the agent */
  public src: string;
  /** The extension of the file */
  public ext: string;

  /** file without extension */
  public srcNoExt: string

  /** The current working directory of the source file */
  public cwd: string;
  /** The command used to run the file */
  public cmd: string = null;

  /**
   * Creation date of the agent
   */
  public creationDate: Date;

  /** internal buffer to store stdout from an agent that has yet to be delimited / used */
  public _buffer: Array<string> = []; 

  /**
   * The associatted process running the Agent
   */
  process: ChildProcess = null;

  /**
   * Current status of the agent
   */
  public status: Agent.Status = Agent.Status.UNINITIALIZED;

  /** The commands collected so far for the current move */
  public currentMoveCommands: Array<string> = [];

  
  // a promise that resolves when the Agent's current move in the `Match` is finished
  public currentMovePromise: Promise<void>;
  public currentMoveResolve: Function = () => {}; // set as a dummy function
  public currentMoveReject: Function;

  public agentTimeStep = 0;

  public clearTimer: Function = () => {};

  private log = new Logger();

  /** whether agent is allowed to send commands. Used to help ignore extra output from agents */
  private allowedToSendCommands = true;
  
  constructor(file: string, options: any) {
    this.creationDate = new Date();

    this.ext = path.extname(file);
    switch(this.ext) {
      case '.py':
        this.cmd = 'python';
        break;
      case '.js':
      case '.ts':
        this.cmd = 'node';
        break;
      case '.java':
        this.cmd = 'java';
        break;
      case '.php':
        this.cmd = 'php';
        break;
      case '.c':
      case '.cpp':
      case '.go':
        this.cmd = ''
        break;
      default:
        // throw new DimensionError(`${ext} is not a valid file type`);
    }
    let pathparts = file.split('/');
    this.cwd = pathparts.slice(0, -1).join('/');
    this.src = pathparts.slice(-1).join('/');
    this.srcNoExt = this.src.slice(0, -this.ext.length);

    // check if file exists
    if(!fs.existsSync(file)) {
      throw new FatalError(`${file} does not exist, check if file path provided is correct`);
    }

    if (options.command) {
      this.cmd = options.command;
    } else if (this.cmd === undefined || this.cmd === null) {
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
    this.status = Agent.Status.READY;

  }


  /**
   * Compile whatever is needed
   */
  async _compile(): Promise<void> {
    return new Promise((resolve, reject) => {
      switch(this.ext) {
        case '.py':
        case '.js':
        case '.php':
          resolve();
          break;
        case '.ts':
          //tsc --esModuleInterop --allowJs -m commonjs --lib es5
          exec(`tsc --esModuleInterop --allowJs -m commonjs --lib es5 ${this.src}`, {
            cwd: this.cwd
          }, (err) => {
            if (err) reject(err);
            resolve();
          });
          break;
        case '.go':
          exec(`go build -o ${this.srcNoExt}.out ${this.src}`, {
            cwd: this.cwd
          }, (err) => {
            if (err) reject(err);
            resolve();
          });
          break;
        case '.cpp':
          exec(`g++ -O3  -o ${this.srcNoExt}.out ${this.src}`, {
            cwd: this.cwd
          }, (err) => {
            if (err) reject(err);
            resolve();
          });
          break;
        case '.c':
          exec(`gcc -O3 -o ${this.srcNoExt}.out ${this.src}`, {
            cwd: this.cwd
          }, (err) => {
            if (err) reject(err);
            resolve();
          });
          break;
        case '.java':
          exec("javac " + this.src, {
            cwd: this.cwd
          }, (err) => {
            if (err) reject(err);
            resolve();
          });
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
        case '.php':
          p = spawn(this.cmd, [this.src], {
            cwd: this.cwd
          }).on('error', function( err ){ reject(err) });
          resolve(p);
          break;
        case '.ts':
          p = spawn(this.cmd, [this.srcNoExt + '.js'], {
            cwd: this.cwd
          }).on('error', function( err ){ reject(err) });
          resolve(p);
          break;
        case '.java':
          p = spawn(this.cmd, [this.srcNoExt], {
            cwd: this.cwd
          }).on('error', function( err ){ reject(err) });
          resolve(p);
          break;
        case '.c':
        case '.cpp':
        case '.go':
          p = spawn('./' + this.srcNoExt + '.out', {
            cwd: this.cwd
          }).on('error', function( err ){ reject(err) });
          resolve(p);
          break;
        case '.php':
          p = spawn(this.cmd, [this.src], {
            cwd: this.cwd
          }).on('error', function( err ){ reject(err) });
          resolve(p);
        default:
          reject('Unrecognized file');
      }
    })
  }


  /**
   * Returns true if this agent was terminated and no longer send or receive emssages
   */
  isTerminated() {
    return this.status === Agent.Status.KILLED;
  }

  _terminate() {
    this.status = Agent.Status.KILLED;
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
export module Agent {
  /**
   * Status enums for an Agent
   */
  export enum Status {
    /** When agent is just created */
    UNINITIALIZED = 'uninitialized', // just created agent
    /** Agent is ready too be used by the {@link MatchEngine} in a {@link Match} */
    READY = 'ready', 
    /** Agent is currently running */
    RUNNING = 'running',
    /** Agent crashed somehow */
    CRASHED = 'crashed',
    /** Agent is finished and no longer in use after {@link Match} ended or was prematurely killed */
    KILLED = 'killed',
    /** Agent is currently not running */
    STOPPED = 'stpped'
  }
  /**
   * Agent ID
   */
  export type ID = number;
}
