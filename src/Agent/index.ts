import { ChildProcess, exec, spawn, execSync } from "child_process";
import path from 'path';
import fs from 'fs';
import os from 'os';
import { Logger } from "../Logger";
import { FatalError } from "../DimensionError";
import { Tournament } from "../Tournament";
import { BOT_USER } from "../MatchEngine";
import { deepMerge } from "../utils/DeepMerge";

/**
 * @class Agent
 * @classdesc The agent is what participates in a match and contains details on the files powering the agent, the
 * process associated and if it is terminated or not.
 * 
 * Reads in a file source for the code and copies the bot folder to a temporary directory in secure modes
 * and creates an `Agent` for use in the {@link MatchEngine} and {@link Match}
 * 
 * This is a class that should not be broken. If someting goes wrong, this should always throw a FatalError. It is 
 * expected that agents are used knowing beforehand that the file given is validated
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
   * The original file path provided
   */
  public file: string;

  /**
   * The agent's options
   */
  public options: Agent.Options = {
    secureMode: true,
    loggingLevel: Logger.LEVEL.INFO,
    id: -1,
    tournamentID: null,
    name: null,
    maxInstallTime: 300000,
    maxCompileTime: 60000
  };

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
  
  /* istanbul ignore next */
  public currentMoveResolve: Function = () => {}; // set as a dummy function
  public currentMoveReject: Function;

  public agentTimeStep = 0;

  public clearTimer: Function = () => {};

  private log = new Logger();

  /** whether agent is allowed to send commands. Used to help ignore extra output from agents */
  private allowedToSendCommands = true;
  
  constructor(file: string, options: Partial<Agent.Options>) {

    
    this.creationDate = new Date();
    this.options = deepMerge(this.options, options);

    this.ext = path.extname(file);
    let pathparts = file.split('/');
    this.cwd = pathparts.slice(0, -1).join('/');
    this.src = pathparts.slice(-1).join('/');
    this.srcNoExt = this.src.slice(0, -this.ext.length);

    // check if file exists
    if(!fs.existsSync(file)) {
      throw new FatalError(`${file} does not exist, check if file path provided is correct`);
    }

    // check if folder is valid
    if(!fs.existsSync(this.cwd)) {
      throw new FatalError(`${this.cwd} directory does not exist, check if directory provided is correct`);
    }

    this.file = file;
    
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
    

    // if we are running in secure mode, we copy the agent over to a temporary directory
    if (this.options.secureMode) {
      let tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbot-'));
      let stats = fs.statSync(this.cwd);
      if (stats.isDirectory()) {
        execSync(`sudo cp -R ${this.cwd}/* ${tempDir}`);
        execSync(`chown -R dimensions_bot ${tempDir}`);
        this.cwd = tempDir;
        this.file = `${path.join(tempDir, this.src)}`;
      }
      else {
        throw new FatalError(`${this.cwd} is not a directory`);
      }
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
   * Install whatever is needed through a install.sh file in the root of the bot folder
   */
  _install(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (fs.existsSync(path.join(this.cwd, 'install.sh'))) {
         // run in restricted bash if in secureMode
        let p: ChildProcess;
        let installTimer = setTimeout(() => {
          reject(new FatalError('Agent went over install time during install stage'));
        }, this.options.maxInstallTime);
        if (this.options.secureMode) {
          p = spawn('sudo', ['-H' ,'-u',BOT_USER, 'rbash' ,'install.sh'], {
            cwd: this.cwd,
            stdio: 'ignore'
          });
        }
        else {
          p = spawn('bash' ,['install.sh'], {
            cwd: this.cwd,
            stdio: 'ignore'
          });
        }
        p.on('error', (err) => {
          clearTimeout(installTimer);
          reject(err)
        });
        p.on('close', () => {
          clearTimeout(installTimer);
          resolve();
        });
      }
      else {
        resolve();
      }
    });
  }

  /**
   * Compile whatever is needed
   */
  _compile(): Promise<void> {
    return new Promise((resolve, reject) => {
      switch(this.ext) {
        case '.py':
        case '.js':
        case '.php':
          resolve();
          break;
          // TODO: change all exec's to spawns
        case '.ts':
          //tsc --esModuleInterop --allowJs -m commonjs --lib es5
          exec(`sudo tsc --esModuleInterop --allowJs -m commonjs --lib es5 ${this.src}`, {
            cwd: this.cwd
          }, (err) => {
            if (err) reject(err);
            resolve();
          });
          break;
        case '.go':
          exec(`sudo go build -o ${this.srcNoExt}.out ${this.src}`, {
            cwd: this.cwd
          }, (err) => {
            if (err) reject(err);
            resolve();
          });
          break;
        case '.cpp':
          exec(`sudo g++ -O3  -o ${this.srcNoExt}.out ${this.src}`, {
            cwd: this.cwd
          }, (err) => {
            if (err) reject(err);
            resolve();
          });
          break;
        case '.c':
          exec(`sudo gcc -O3 -o ${this.srcNoExt}.out ${this.src}`, {
            cwd: this.cwd
          }, (err) => {
            if (err) reject(err);
            resolve();
          });
          break;
        case '.java':
          console.log(this.cwd);
          exec("sudo javac " + this.src, {
            cwd: this.cwd
          }, (err) => {
            if (err) reject(err);
            resolve();
          });
          break;
      }
    });
  }

  /**
   * Spawn the process and return the process
   */
  async _spawn(): Promise<ChildProcess> {

      let p: ChildProcess;
      switch(this.ext) {
        case '.py':
        case '.js':
        case '.php':
          return this.spawnProcess(this.cmd, [this.src]);
        case '.ts':
          return this.spawnProcess(this.cmd, [this.srcNoExt + '.js']);
        case '.java':
          return this.spawnProcess(this.cmd, [this.srcNoExt]);
        case '.c':
        case '.cpp':
        case '.go':
          return this.spawnProcess('./' + this.srcNoExt + '.out', [])
        default:
          throw new FatalError('Unrecognized file');
      }
  }


  /**
   * Spawns process accordingly and uses the configs accordingly
   * Resolves with the process if spawned succesfully
   */
  spawnProcess(command: string, args: Array<string>): Promise<ChildProcess> {
    return new Promise((resolve, reject) => {
      // let p = spawn(command, args, {
      //   cwd: this.cwd
      // }).on('error', (err) => { reject(err) });
      // resolve(p);
      if (this.options.secureMode) {
        let p = spawn('sudo', ['-H', '-u', BOT_USER, command, ...args], {
          cwd: this.cwd
        }).on('error', (err) => { reject(err) });
        resolve(p);
      }
      else {
        let p = spawn(command, args, {
          cwd: this.cwd
        }).on('error', (err) => { reject(err) });
        resolve(p);
      }
    });
  }

  /**
   * Returns true if this agent was terminated and no longer send or receive emssages
   */
  isTerminated() {
    return this.status === Agent.Status.KILLED;
  }

  _terminate() {
    this.process.kill('SIGKILL');
    this.status = Agent.Status.KILLED;
  }

  _disallowCommands() {
    this.allowedToSendCommands = false;
  }
  _allowCommands() {
    this.allowedToSendCommands = true;
  }
  isAllowedToSendCommands() {
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
   * @param secureMode - whether to generate the agent securely. @default `true`
   */
  static generateAgents(files: Array<String> | Array<{file: string, name: string}> | Array<{file: string, tournamentID: Tournament.ID}>, loggingLevel: Logger.LEVEL, secureMode: boolean = true): Array<Agent> {
    if (files.length === 0) {
      throw new FatalError('No files provided to generate agents with!');
    }
    let agents: Array<Agent> = [];

    if (typeof files[0] === 'string') {
      files.forEach((file, index) => {
        agents.push(new Agent(file, {id: index, name: null, loggingLevel: loggingLevel, secureMode: secureMode}))
      })
    }
    //@ts-ignore
    else if (files[0].name !== undefined) {
      files.forEach((info, index) => {
        agents.push(new Agent(info.file, {id: index, name: info.name, loggingLevel: loggingLevel, secureMode: secureMode}))
      })
    }
    else {
      files.forEach((info, index) => {
        agents.push(new Agent(info.file, {id: index, tournamentID: info.tournamentID, loggingLevel: loggingLevel, secureMode: secureMode}))
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

  /**
   * Agent options interface
   */
  export interface Options {
    /** Name of agent */
    name: string,

    /** 
     * Whether or not to spawn agent securely and avoid malicious activity 
     * @default `true`
     */
    secureMode: boolean

    /** A specified ID to use for the agent */
    id: ID,

    /** A specified tournament ID linking an agent to the tournament it belongs to */
    tournamentID: Tournament.ID,

    /** Logging level of this agent */
    loggingLevel: Logger.LEVEL,

    /**  
     * Maximium time allowed for an agent to spend on the installing step
     * @default 5 minutes (300,000 ms)
     */
    maxInstallTime: number

    /**
     * Maximum time allowed to be spent compiling
     * @default 1 minute (60,000 ms)
     */
    maxCompileTime: number
  }
}
