import { ChildProcess, spawn, execSync, exec } from "child_process";
import path from 'path';
import fs from 'fs';
import os from 'os';
import treekill from 'tree-kill';
import { Logger } from "../Logger";
import { FatalError, AgentFileError, AgentDirectoryError, AgentMissingIDError, AgentInstallTimeoutError, AgentCompileTimeoutError, NotSupportedError, AgentCompileError, AgentInstallError } from "../DimensionError";
import { Tournament } from "../Tournament";
import { BOT_USER, ROOT_USER, MatchEngine } from "../MatchEngine";
import { deepMerge } from "../utils/DeepMerge";
import { genID } from "../utils";
import { deepCopy } from "../utils/DeepCopy";
import { DeepPartial } from "../utils/DeepPartial";
import { Writable, Readable, EventEmitter, Stream, Duplex } from "stream";
import Dockerode from "dockerode";
import { isChildProcess } from "../utils/TypeGuards";

const containerBotFolder = '/code';

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
export class Agent extends EventEmitter {
  
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
   * @default `agent_[agent.id]`
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
   * The associated process running the Agent
   */
  private process: ChildProcess = null;

  /**
   * Associated docker container running the agent
   */
  private container: Dockerode.Container = null;

  /**
   * Streams associated with the agent
   */
  public streams: Agent.Streams = {
    in: null,
    out: null,
    err: null
  }

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

  /**
   * Key used to retrieve the error logs of this agent
   */
  public logkey: string = null;

  /** whether agent is allowed to send commands. Used to help ignore extra output from agents */
  private allowedToSendCommands = true;
  
  constructor(file: string, options: Partial<Agent.Options>) {
    super();
    this.creationDate = new Date();
    this.options = deepMerge(this.options, deepCopy(options));
    
    this.log.level = this.options.loggingLevel;

    this.ext = path.extname(file);
    let pathparts = file.split('/');
    this.cwd = pathparts.slice(0, -1).join('/');
    this.src = pathparts.slice(-1).join('/');
    this.srcNoExt = this.src.slice(0, -this.ext.length);
    
    // check if folder is valid
    if(!fs.existsSync(this.cwd)) {
      throw new AgentDirectoryError(`${this.cwd} directory does not exist, check if directory provided through the file is correct`, this.id);
    }

    // check if file exists
    if(!fs.existsSync(file)) {
      throw new AgentFileError(`${file} does not exist, check if file path provided is correct`, this.id);
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
    // if (this.options.secureMode) {
    //   let botDir = path.join(os.tmpdir(), '/dbot');
    //   if (!fs.existsSync(botDir)) {
    //     // create the temporary bot directory and change perms so that other users cannot read it
    //     fs.mkdirSync(botDir);
    //     execSync(`sudo chown ${ROOT_USER} ${botDir}`);
    //     execSync(`sudo chmod o-r ${botDir}`);
    //     // This makes it hard for bots to try to look for other bots and copy code
    //     // without access to reading the directory
    //   }
    //   // create a temporary directory generated as bot-<12 char nanoID>-<6 random chars.
    //   let tempDir = fs.mkdtempSync(path.join(botDir, `/bot-${genID(12)}-`));
    //   let stats = fs.statSync(this.cwd);

    //   if (stats.isDirectory()) {
    //     // copy all files in the bot directory to the temporary one
    //     execSync(`sudo cp -R ${this.cwd}/* ${tempDir}`);

    //     // set BOT_USER as the owner
    //     execSync(`sudo chown -R ${BOT_USER} ${tempDir}`);

    //     // update the current working directory and file fields.
    //     this.cwd = tempDir;
    //     this.file = path.join(tempDir, this.src);
    //   }
    //   else {
    //     throw new AgentDirectoryError(`${this.cwd} is not a directory`, this.id);
    //   }
    // }
    

    if (this.options.id !== null) {
      this.id = options.id;
    } else {
      throw new AgentMissingIDError(`No id provided for agent using ${file}`, this.id);
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
  _install(stderrWritestream?: Writable, stdoutWritestream?: Writable): Promise<void> {
    return new Promise(async (resolve, reject) => {

      // if there is a install.sh file, use it
      if (fs.existsSync(path.join(this.cwd, 'install.sh'))) {

        let stdout: Readable;
        let stderr: Readable;
        let installTimer = setTimeout(() => {
          reject(new AgentInstallTimeoutError('Agent went over install time during the install stage', this.id));
        }, this.options.maxInstallTime);

        let chunks = [];
        const handleClose = (code: number) => {
          clearTimeout(installTimer);
          if (code === 0) {
            resolve();
          }
          else {
            reject(
              new AgentInstallError(
                `A install time error occured. Install step for agent ${this.id} exited with code: ${code}; Installing ${path.join(this.cwd, 'install.sh')}; Install Output:\n${chunks.join('')}`, this.id
              )
            )
          }
        }

        const handleError = (err: Error) => {
          clearTimeout(installTimer);
          reject(err);
        }

        if (this.options.secureMode) {
          try {
            let data = await this.containerSpawn(path.join(containerBotFolder, 'install.sh'));
            stderr = data.err;
            stdout = data.out;
            data.stream.on('end', async () => {
              let endRes = await data.exec.inspect();
              handleClose(endRes.ExitCode);
            });
            data.stream.on('error', (err) => {
              handleError(err);
            });
          }
          catch(err) {
            handleError(err);
          }
        }
        else {
          let p = spawn('bash' ,['install.sh'], {
            cwd: this.cwd
          });
          p.on('error', (err) => {
            handleError(err);
          });
          p.on('close', (code) => {
            handleClose(code);
          });
          stderr = p.stderr;
          stdout = p.stdout;
        }
        
        stdout.on('data', (chunk) => {
          chunks.push(chunk);
        });
        stderr.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        if (stderrWritestream) {
          stderr.pipe(stderrWritestream, {
            end: false,
          });
        }
        if (stdoutWritestream) {
          stdout.pipe(stdoutWritestream, {
            end: false,
          });
        }

        
      }
      else {
        resolve();
      }
    });
  }

  /**
   * Compile whatever is needed and validate files. Called by {@link MatchEngine} and has a timer set by the 
   * maxCompileTime option in {@link Agent.Options}
   */
  async _compile(stderrWritestream?: Writable, stdoutWritestream?: Writable): Promise<void> {
    return new Promise( async (resolve, reject) => {
      let p: ChildProcess | Agent.ContainerExecData;
      let stdout: Readable;
      let stderr: Readable;
      let compileTimer = setTimeout(() => {
        reject(new AgentCompileTimeoutError('Agent went over compile time during the compile stage', this.id));
      }, this.options.maxCompileTime);
      if (this.options.compileCommands[this.ext]) {
        let cmd1 = this.options.compileCommands[this.ext][0];
        let restofCmds = this.options.compileCommands[this.ext].slice(1);
        p = await this._spawnCompileProcess(cmd1, [...restofCmds, this.src])
      }
      else {
        switch(this.ext) {
          case '.py':
          case '.php':
            clearTimeout(compileTimer);
            resolve();
            return;
            // TODO: Make these compile options configurable
          case '.js':
            clearTimeout(compileTimer);
            resolve();
            return;
            // p = await this._spawnCompileProcess('node', ['--check', this.src])
          case '.ts':
            // expect user to provide a tsconfig.json
            p = await this._spawnCompileProcess('tsc', [])
            break;
          case '.go':
            p = await this._spawnCompileProcess('go', ['build', '-o', `${this.srcNoExt}.out`, this.src])
            break;
          case '.cpp':
            p = await this._spawnCompileProcess('g++', ['-std=c++11', '-O3', '-o', `${this.srcNoExt}.out`, this.src])
            break;
          case '.c':
            p = await this._spawnCompileProcess('gcc', ['-O3', '-o', `${this.srcNoExt}.out`, this.src])
            break;
          case '.java':
            p = await this._spawnCompileProcess('javac', [this.src])
            break;
          default:
            reject(new NotSupportedError(`Language with extension ${this.ext} is not supported at the moment`));
            break;
        }
      }
      let chunks = [];
      const handleClose = (code: number) => {
        clearTimeout(compileTimer);
        if (code === 0) {
          resolve();
        }
        else {
          reject(new AgentCompileError(`A compile time error occured. Compile step for agent ${this.id} exited with code: ${code}; Compiling ${this.file}; Compile Output:\n${chunks.join('')}`, this.id));
        }
      }
      const handleError = (err: Error) => {
        clearTimeout(compileTimer);
        reject(err);
      }
      if (isChildProcess(p)) {
        stdout = p.stdout;
        stderr = p.stderr;
        p.on('error', (err) => {
          handleError(err);
        });
        p.on('close', (code) => {
          handleClose(code);
        });
      }
      else {
        stdout = p.out;
        stderr = p.err;
        let exec = p.exec;
        p.stream.on('error', (err) => {
          handleError(err);
        })
        p.stream.on('end', async () => {
          let endRes = await exec.inspect();
          handleClose(endRes.ExitCode);
        })
      }

      stdout.on('data', (chunk) => {
        chunks.push(chunk);
      });
      stderr.on('data', (chunk) => {
        chunks.push(chunk);
      });
      if (stderrWritestream) {
        stderr.pipe(stderrWritestream, {
          end: false
        });
      }
      if (stdoutWritestream) {
        stdout.pipe(stdoutWritestream, {
          end: false
        });
      }
    });
  }

  async _spawnCompileProcess(command: string, args: Array<string>): Promise<ChildProcess | Agent.ContainerExecData> {
    return new Promise((resolve, reject) => {
      if (this.options.secureMode) {
        this.containerSpawn(`${command} ${args.join(" ")}`).then(resolve).catch(reject);
      }
      else {
        let p = spawn(command, [...args], {
          cwd: this.cwd
        }).on('error', (err) => { reject(err) })
        resolve(p);
      }
    });
  }

  /**
   * Executes the given command string in the agent's container and attaches stdin, stdout, and stderr accordingly
   * @param command - the command to execute in the container
   */
  async containerSpawn(command: string): Promise<Agent.ContainerExecData> {
    let exec = await this.container.exec({
      Cmd: ['/bin/bash', '-c', command],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
    });

    let stream = await exec.start({stdin: true, hijack: true});
    let instream = new Stream.PassThrough();
    let outstream = new Stream.PassThrough();
    let errstream = new Stream.PassThrough();
    instream.pipe(stream);
    this.container.modem.demuxStream(stream, outstream, errstream);

    return {
      in: instream,
      out: outstream,
      err: errstream,
      stream,
      exec,
    }
  }

  /**
   * Spawn the process and return the process
   */
  async _spawn(): Promise<ChildProcess> {
    if (this.options.runCommands[this.ext]) {
      let p = this._spawnProcess(this.options.runCommands[this.ext][0], [...this.options.runCommands[this.ext].slice(1), this.src]);
      return p;
    }
    else {
      switch(this.ext) {
        case '.py':
        case '.js':
        case '.php':
          let p = this._spawnProcess(this.cmd, [this.src]);
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
          detached: false,
        }).on('error', (err) => { reject(err) })
        resolve(p);
        
      }
      else {
        let p = spawn(command, args, {
          cwd: this.cwd,
          detached: false
        }).on('error', (err) => { reject(err) });
        resolve(p);
      }
    });
  }

  /**
   * Stop an agent provided it is not terminated. To terminate it, see {@link _terminate};
   */
  async stop() {
    if (!this.isTerminated()) {
      if (this.options.secureMode) {
        await this.container.pause();
      }
      else {
        this.process.kill('SIGSTOP');
      }
      this.status = Agent.Status.STOPPED;
    }
  }

  /**
   * Resume an agent as long it is not terminated already
   */
  async resume() {
    if (!this.isTerminated()) {
      this._allowCommands();
      if (this.options.secureMode) {
        // await this.container.unpause();
      } else { 
        this.process.kill('SIGCONT');
      }
      this.status = Agent.Status.RUNNING;
    }
  }

  /**
   * timeout the agent
   */
  timeout() {
    this.emit(Agent.AGENT_EVENTS.TIMEOUT);
  }

  /**
   * call out agent for exceeding memory limit
   */
  overMemory() {
    this.emit(Agent.AGENT_EVENTS.EXCEED_MEMORY_LIMIT);
  }

  /**
   * Whether or not there is a process associated with the agent
   */
  hasProcess() {
    return this.process ? true : false;
  }

  /**
   * Whether or not input is destroyed
   */
  inputDestroyed() {
    return this.streams.in.destroyed;
  }

  /**
   * Write to stdin of the process associated with the agent
   * @param message - the message
   * @param callback - callback function
   */
  write(message: string, callback: (error: Error) => void) {
    this.streams.in.write(message, callback);
  }

  /**
   * Get process of agent
   */
  _getProcess() {
    return this.process;
  }

  /**
   * Store process for agent
   * @param p - process to store
   */
  _storeProcess(p: ChildProcess) {
    this.process = p;
  }

  /**
   * Store container for agent
   * @param c - container to store
   */
  _storeContainer(c: Dockerode.Container) {
    this.container = c;
  }

  /**
   * TODO: should be removed, replace with agent internal function
   */
  _getContainer() {
    return this.container;
  }

  /**
   * Get the PID of the process
   */
  _getProcessPID() {
    return this.process.pid;
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
  _terminate(): Promise<void> {
    this.status = Agent.Status.KILLED;
    return new Promise((resolve, reject) => {
      
      if (this.options.secureMode) {
        // this.container.stop().then(() => {
        //   this.container.remove().then(resolve).catch(reject);
        // }).catch(reject)
        resolve();
      }
      else {
        treekill(this.process.pid, 'SIGKILL', (err) => {
          this._clearTimer();
          clearInterval(this.memoryWatchInterval);

          if (err) {
            reject(err);
          }
          else {
            resolve();
          }
        });
      }
    });
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
  async _finishMove() {
    this._clearTimer();

    // Resolve move and tell engine in `getCommands` this agent is done outputting commands and awaits input
    this._currentMoveResolve();
            
    // stop the process for now from sending more output and disallow commmands to ignore rest of output
    if (this.options.secureMode) {
      // await this.container.pause();
    } else {
      this.process.kill('SIGSTOP');
    }
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
      throw new AgentFileError('No files provided to generate agents with!', -1);
    }
    let agents: Array<Agent> = [];

    if (typeof files[0] === 'string') {
      files.forEach((file, index: number) => {
        let configs = deepCopy(options);
        configs.id = index;
        //@ts-ignore
        agents.push(new Agent(file, configs))
      })
    }
    //@ts-ignore
    else if (files[0].name !== undefined) {
      files.forEach((info, index: number) => {
        let configs = deepCopy(options);
        configs.id = index;
        configs.name = info.name;
        //@ts-ignore
        agents.push(new Agent(info.file, configs))
      });
    }
    else {
      files.forEach((info, index: number) => {
        let configs = deepCopy(options);
        configs.id = index;
        configs.tournamentID = info.tournamentID;
        //@ts-ignore
        agents.push(new Agent(info.file, configs))
      })
    }
    return agents;
  }

  getAgentErrorLogFilename() {
    return `agent_${this.id}.log`
  }
}

export module Agent {

  /**
   * Stream data for any process
   */
  export interface Streams {
    in: Writable,
    out: Readable,
    err: Readable,
  }

  /**
   * data related to executing a command in a container, with stream data, and the exec object
   */
  export interface ContainerExecData extends Streams {
    exec: Dockerode.Exec,
    stream: Duplex,
  }

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

    /**
     * Map from extension type to set of commands used to compile this agent instead of the defaults. When there is no 
     * mapping default is used
     * 
     * @default `null`
     */
    compileCommands: { [x in string]: Array<string> }

    /**
     * Map from extension type to set of commands used to run this agent instead of the defaults. When there is no 
     * mapping default is used
     * 
     * @default `null`
     */
    runCommands: { [x in string]: Array<string> }
  }
  
  /**
   * Agent events
   */
  export enum AGENT_EVENTS {
    /**
     * Event emitted by process of {@link Agent} when memory limit is exceeded
     */
    EXCEED_MEMORY_LIMIT = 'exceedMemoryLimit',
    /**
     * Event emitted by process of {@link Agent} when it times out.
     */
    TIMEOUT = 'timeout',
    /**
     * event emitted when associated process or container for agent closes and agent effectively is terminated
     */
    CLOSE = 'close'
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
    maxCompileTime: 60000,
    runCommands: {},
    compileCommands: {}
  };
}
