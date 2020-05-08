import { ChildProcess, spawn, execSync } from "child_process";
import path from 'path';
import fs from 'fs';
import os from 'os';
import { Logger } from "../Logger";
import { FatalError, AgentFileError, AgentDirectoryError, AgentMissingIDError, AgentInstallTimeoutError, AgentCompileTimeoutError, NotSupportedError, AgentCompileError, AgentInstallError } from "../DimensionError";
import { Tournament } from "../Tournament";
import { BOT_USER, ROOT_USER } from "../MatchEngine";
import { deepMerge } from "../utils/DeepMerge";
import { genID } from "../utils";
import { deepCopy } from "../utils/DeepCopy";
import { DeepPartial } from "../utils/DeepPartial";

/**
 * @class Agent
 * @classdesc The agent is what participates in a match and contains details on the files powering the agent, the
 * process associated and many other details.
 * 
 * Reads in a file source for the code and copies the bot folder to a temporary directory in secure modes
 * and creates an `Agent` for use in the {@link MatchEngine} and {@link Match}
 * 
 * This is a class that should not be broken. If something goes wrong, this should always throw a error. It is 
 * expected that agents are used knowing beforehand that the file given is validated
 */
export class Agent {
  
  /**
   * This agent's ID in a match. It is always a non-negative integer and agents in a match are always numbered 
   * `0, 1, 2, ...n` where there are `n` agents.
   */
  public id: Agent.ID = 0;

  /**
   * A tournmanet ID if Agent is generated from within a {@link Tournament}
   */
  public tournamentID: Tournament.ID = null;

  /**
   * Name of the agent
   * @default `agent_[agent.id]``
   */
  public name: string;

  /** The source path to the file that runs the agent */
  public src: string;

  /** The extension of the file */
  public ext: string;

  /** file without extension */
  public srcNoExt: string

  /** 
   * The current working directory of the source file. If in insecure mode, this is always a temporary directory that 
   * will get deleted later.
   */
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
  public options: Agent.Options = deepCopy(Agent.OptionDefaults);

  /**
   * Creation date of the agent
   */
  public creationDate: Date;

  /** internal buffer to store stdout from an agent that has yet to be delimited / used */
  public _buffer: Array<string> = []; 

  /** Interval that periodically watches the memory usage of the process associated with this agent */
  public memoryWatchInterval = null;

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

  
  /** a promise that resolves when the Agent's current move in the {@link Match} is finished */
  public _currentMovePromise: Promise<void>;
  
  /* istanbul ignore next */
  public _currentMoveResolve: Function = () => {}; // set as a dummy function
  public _currentMoveReject: Function;

  /** A number that counts the number of times the agent has essentially interacted with the {@link MatchEngine} */
  public agentTimeStep = 0;

  /** Clears out the timer associated with the agent during a match */
  public _clearTimer: Function = () => {};

  private log = new Logger();

  /** whether agent is allowed to send commands. Used to help ignore extra output from agents */
  private allowedToSendCommands = true;
  
  constructor(file: string, options: Partial<Agent.Options>) {

    this.creationDate = new Date();
    this.options = deepMerge(this.options, deepCopy(options));
    
    this.log.level = this.options.loggingLevel;

    this.ext = path.extname(file);
    let pathparts = file.split('/');
    this.cwd = pathparts.slice(0, -1).join('/');
    this.src = pathparts.slice(-1).join('/');
    this.srcNoExt = this.src.slice(0, -this.ext.length);

    // check if file exists
    if(!fs.existsSync(file)) {
      throw new AgentFileError(`${file} does not exist, check if file path provided is correct`);
    }

    // check if folder is valid
    if(!fs.existsSync(this.cwd)) {
      throw new AgentDirectoryError(`${this.cwd} directory does not exist, check if directory provided through the file is correct`);
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
    }

    // if we are running in secure mode, we copy the agent over to a temporary directory
    if (this.options.secureMode) {
      let botDir = path.join(os.tmpdir(), '/dbot');
      if (!fs.existsSync(botDir)) {
        // create the temporary bot directory and change perms so that other users cannot read it
        fs.mkdirSync(botDir);
        execSync(`sudo chown ${ROOT_USER} ${botDir}`);
        execSync(`sudo chmod o-r ${botDir}`);
        // This makes it hard for bots to try to look for other bots and copy code
        // without access to reading the directory
      }
      // create a temporary directory generated as bot-<12 char nanoID>-<6 random chars.
      let tempDir = fs.mkdtempSync(path.join(botDir, `/bot-${genID(12)}-`));
      let stats = fs.statSync(this.cwd);

      if (stats.isDirectory()) {
        // copy all files in the bot directory to the temporary one
        execSync(`sudo cp -R ${this.cwd}/* ${tempDir}`);

        // set BOT_USER as the owner
        execSync(`sudo chown -R ${BOT_USER} ${tempDir}`);

        // update the current working directory and file fields.
        this.cwd = tempDir;
        this.file = path.join(tempDir, this.src);
      }
      else {
        throw new AgentDirectoryError(`${this.cwd} is not a directory`);
      }
    }
    

    if (this.options.id !== null) {
      this.id = options.id;
    } else {
      throw new AgentMissingIDError(`No id provided for agent using ${file}`);
    }
    if (this.options.name) {
      this.name = this.options.name;
    }
    else {
      this.name = `agent_${this.id}`;
    }
    if (this.options.tournamentID) {
      this.tournamentID = options.tournamentID;
      this.name = this.tournamentID.name;
    }

    this.log.system(`Created agent: ${this.name}`);

    // set agent as ready
    this.status = Agent.Status.READY;

  }

  /**
   * Install whatever is needed through a `install.sh` file in the root of the bot folder
   */
  _install(): Promise<void> {
    return new Promise((resolve, reject) => {

      // if there is a install.sh file, use it
      if (fs.existsSync(path.join(this.cwd, 'install.sh'))) {

        // run in restricted bash if in secureMode
        let p: ChildProcess;
        let installTimer = setTimeout(() => {
          reject(new AgentInstallTimeoutError('Agent went over install time during the install stage'));
        }, this.options.maxInstallTime);
        if (this.options.secureMode) {
          p = spawn('sudo', ['-H' ,'-u', BOT_USER, 'rbash' ,'install.sh'], {
            cwd: this.cwd
          });
        }
        else {
          p = spawn('bash' ,['install.sh'], {
            cwd: this.cwd,
            stdio: 'ignore'
          });
        }
        let chunks = [];
        p.stdout.on('data', (chunk) => {
          chunks.push(chunk);
        });
        p.stderr.on('data', (chunk) => {
          chunks.push(chunk);
        });

        p.on('error', (err) => {
          clearTimeout(installTimer);
          reject(err)
        });
        p.on('close', (code) => {
          clearTimeout(installTimer);
          if (code === 0) {
            resolve();
          }
          else {
            reject(new AgentInstallError(`A install time error occured. Install step for agent ${this.id} exited with code: ${code}; Installing ${path.join(this.cwd, 'install.sh')}; Install Output:\n${chunks.join('')}`))
          }
        });
      }
      else {
        resolve();
      }
    });
  }

  /**
   * Compile whatever is needed. Called by {@link MatchEngine} and has a timer set by the maxCompileTime option in
   * {@link Agent.Options}
   */
  _compile(): Promise<void> {
    return new Promise((resolve, reject) => {
      let p: ChildProcess;
      let compileTimer = setTimeout(() => {
        reject(new AgentCompileTimeoutError('Agent went over compile time during the compile stage'));
      }, this.options.maxCompileTime);
      switch(this.ext) {
        case '.py':
        case '.js':
        case '.php':
          resolve();
          break;
          // TODO: Make these compile options configurable
        case '.ts':
          p = spawn(`sudo`, [...`tsc --esModuleInterop --allowJs -m commonjs --lib es5`.split(' '), this.src], {
            cwd: this.cwd
          });
          break;
        case '.go':
          p = spawn(`sudo`, ['go', 'build', '-o', `${this.srcNoExt}.out`, this.src], {
            cwd: this.cwd
          });
          break;
        case '.cpp':
          p = spawn(`sudo`, ['g++', '-O3', '-o', `${this.srcNoExt}.out`, this.src], {
            cwd: this.cwd
          })
          break;
        case '.c':
          p = spawn(`sudo`, ['gcc', '-O3', '-o', `${this.srcNoExt}.out`, this.src], {
            cwd: this.cwd
          });
          break;
        case '.java':
          p = spawn(`sudo`, ['javac', this.src], {
            cwd: this.cwd
          });
          break;
        default:
          reject(new NotSupportedError(`Language with extension ${this.ext} is not supported at the moment`));
          break;
      }
      if (p) {
        p.on('error', (err) => {
          clearTimeout(compileTimer);
          reject(err);
        });
        let chunks = [];
        p.stdout.on('data', (chunk) => {
          chunks.push(chunk);
        });
        p.stderr.on('data', (chunk) => {
          chunks.push(chunk);
        });
        p.on('close', (code) => {
          clearTimeout(compileTimer);
          if (code === 0) {
            resolve();
          }
          else {
            reject(new AgentCompileError(`A compile time error occured. Compile step for agent ${this.id} exited with code: ${code}; Compiling ${this.file}; Compile Output:\n${chunks.join('')}`));
          }
        });
      }
      else {
        clearTimeout(compileTimer);
      }
    });
  }

  /**
   * Spawn the process and return the process
   */
  async _spawn(): Promise<ChildProcess> {

      switch(this.ext) {
        case '.py':
        case '.js':
        case '.php':
          let p = this._spawnProcess(this.cmd, [this.src]);
          // set root as the owner again
        
          // execSync(`sudo chown -R ${ROOT_USER} ${this.cwd}`);
          return p;
        case '.ts':
          return this._spawnProcess(this.cmd, [this.srcNoExt + '.js']);
        case '.java':
          return this._spawnProcess(this.cmd, [this.srcNoExt]);
        case '.c':
        case '.cpp':
        case '.go':
          return this._spawnProcess('./' + this.srcNoExt + '.out', [])
        default:
          throw new NotSupportedError(`Language with extension ${this.ext} is not supported yet`)
      }
  }


  /**
   * Spawns process in this.cwd accordingly and uses the configs accordingly.
   * Resolves with the process if spawned succesfully
   * 
   * Note, we are spawning detached so we can kill off all sub processes if they are made. See {@link _terminate} for 
   * explanation
   */
  _spawnProcess(command: string, args: Array<string>): Promise<ChildProcess> {
    return new Promise((resolve, reject) => {
      if (this.options.secureMode) {
        let p = spawn('sudo', ['-H', '-u', BOT_USER, command, ...args], {
          cwd: this.cwd,
          detached: true,
        }).on('error', (err) => { reject(err) });
        resolve(p);
        
      }
      else {
        let p = spawn(command, args, {
          cwd: this.cwd,
          detached: true
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

  /**
   * Terminates this agent by stopping all related processes and remove any temporary directory
   */
  _terminate() {
    // first try to kill the process and all its child processes it spawned
    // trick copied from https://azimi.me/2014/12/31/kill-child_process-node-js.html
    try {
      process.kill(-this.process.pid, 'SIGKILL');
    }
    catch (err) {
      this.log.detail(`couldn't kill group of processes`, err);
      
      try {
        // then just kill the original process
        process.kill(this.process.pid, 'SIGKILL');
      }
      catch (err) {
        // TODO: This lines occurs sometimes but we don't get any orphans or anything still. Not sure why
        this.log.detail(`couldn't kill original process nor the group`, err);
      }
    }

    this._clearTimer();
    clearInterval(this.memoryWatchInterval);
    
    this.status = Agent.Status.KILLED;
  }

  /**
   * Disallow an agent from sending more commands
   */
  _disallowCommands() {
    this.allowedToSendCommands = false;
  }

  /**
   * Allow agent to send commands again
   */
  _allowCommands() {
    this.allowedToSendCommands = true;
  }

  /**
   * Check if agent is set to be allowed to send commands. The {@link EngineOptions} affect when this is flipped
   */
  isAllowedToSendCommands() {
    return this.allowedToSendCommands;
  }

  /**
   * Setup the agent timer clear out method
   */
  _setTimeout(fn: Function, delay: number, ...args: any[]) {
    let timer = setTimeout(() => {
      fn(...args);
    }, delay);
    this._clearTimer = () => {
      clearTimeout(timer);
    }
  }

  /**
   * Stop this agent from more outputs and mark it as done for now and awaiting for updates
   */
  _finishMove() {
    this._clearTimer();

    // Resolve move and tell engine in `getCommands` this agent is done outputting commands and awaits input
    this._currentMoveResolve();
            
    // stop the process for now from sending more output and disallow commmands to ignore rest of output
    this.process.kill('SIGSTOP');
    this._disallowCommands();
  }

  // Start an Agent's move and setup the promise structures
  _setupMove() {
    // allows agent to send commands; increment time; clear past commands; reset the promise structure
    this.allowedToSendCommands = true;
    this.agentTimeStep++;
    this.currentMoveCommands = [];
    this._currentMovePromise = new Promise((resolve, reject) => {
      this._currentMoveResolve = resolve;
      this._currentMoveReject = reject;
    });
  }

  /**
   * Generates a list of agents for use
   * @param files List of files to use to make agents or a list of objects with a file key for the file path to the bot 
   *              and a name key for the name of the agent
   * @param loggingLevel - the logging level for all these agents
   * @param secureMode - whether to generate the agent securely. @default `true`
   */
  static generateAgents(files: Array<String> | Array<{file: string, name: string}> | Array<{file: string, tournamentID: Tournament.ID}>, options: DeepPartial<Agent.Options>): Array<Agent> {
    if (files.length === 0) {
      throw new AgentFileError('No files provided to generate agents with!');
    }
    let agents: Array<Agent> = [];

    if (typeof files[0] === 'string') {
      files.forEach((file, index: number) => {
        let configs = deepCopy(options);
        configs.id = index;
        agents.push(new Agent(file, configs))
      })
    }
    //@ts-ignore
    else if (files[0].name !== undefined) {
      files.forEach((info, index: number) => {
        let configs = deepCopy(options);
        configs.id = index;
        configs.name = info.name;
        agents.push(new Agent(info.file, configs))
      });
    }
    else {
      files.forEach((info, index: number) => {
        let configs = deepCopy(options);
        configs.id = index;
        configs.tournamentID = info.tournamentID;
        agents.push(new Agent(info.file, configs))
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
    STOPPED = 'stopped'
  }

  /**
   * Agent ID. Always a non-negative integer and all agents in a match have IDs that are strictly increasing from `0`
   * 
   * For example, in a 4 agent match, the ids are `0, 1, 2, 3`.
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
     *  
     * When set to true, the agent's file and the directory containing the file are copied over to a temporary directory
     * of which there is restricted access. By default this is false
     * 
     * @default `false` (always inherited from the match configs, see {@link Match.Configs})
     */
    secureMode: boolean

    /** A specified ID to use for the agent */
    id: ID,

    /** A specified tournament ID linking an agent to the {@link Tournament} and {@link Player} it belongs to */
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

  /**
   * Default Agent options
   */
  export const OptionDefaults: Agent.Options = {
    secureMode: false,
    loggingLevel: Logger.LEVEL.INFO,
    id: null,
    tournamentID: null,
    name: null,
    maxInstallTime: 300000,
    maxCompileTime: 60000
  };
}
