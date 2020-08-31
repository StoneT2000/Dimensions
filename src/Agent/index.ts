import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import fs, { WriteStream } from 'fs';
import treekill from 'tree-kill';
import { Logger } from '../Logger';
import {
  AgentFileError,
  AgentDirectoryError,
  AgentMissingIDError,
  AgentInstallTimeoutError,
  AgentCompileTimeoutError,
  NotSupportedError,
  AgentCompileError,
  AgentInstallError,
} from '../DimensionError';
import { Tournament } from '../Tournament';
import { MatchEngine } from '../MatchEngine';
import { deepMerge } from '../utils/DeepMerge';
import { processIsRunning, dockerCopy } from '../utils/System';
import { deepCopy } from '../utils/DeepCopy';
import { DeepPartial } from '../utils/DeepPartial';
import { Writable, Readable, EventEmitter, Stream, Duplex } from 'stream';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Dockerode, { HostConfig } from 'dockerode';
import { isChildProcess } from '../utils/TypeGuards';
import pidusage from 'pidusage';
import DefaultSeccompProfileJSON from '../Security/seccomp/default.json';
import { noop } from '../utils';

const DefaultSeccompProfileString = JSON.stringify(DefaultSeccompProfileJSON);

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
  public srcNoExt: string;

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
    err: null,
  };

  /**
   * Current status of the agent
   */
  public status: Agent.Status = Agent.Status.UNINITIALIZED;

  /** The commands collected so far for the current move */
  public currentMoveCommands: Array<string> = [];

  /** a promise that resolves when the Agent's current move in the {@link Match} is finished */
  public _currentMovePromise: Promise<void>;

  /* istanbul ignore next */
  public _currentMoveResolve: Function = noop; // set as a dummy function
  public _currentMoveReject: Function;

  /** A number that counts the number of times the agent has essentially interacted with the {@link MatchEngine} */
  public agentTimeStep = 0;

  /** Clears out the timer associated with the agent during a match */
  public _clearTimer: Function = noop;

  errorLogWriteStream: WriteStream = null;

  private log = new Logger();

  /**
   * Key used to retrieve the error logs of this agent
   */
  public logkey: string = null;

  /** whether agent is allowed to send commands. Used to help ignore extra output from agents */
  private allowedToSendCommands = true;

  constructor(
    file: string,
    options: Partial<Agent.Options>,
    languageSpecificOptions: Agent.LanguageSpecificOptions = {}
  ) {
    super();
    this.creationDate = new Date();
    this.options = deepMerge(this.options, deepCopy(options));

    this.log.level = this.options.loggingLevel;

    this.ext = path.extname(file);
    if (languageSpecificOptions[this.ext]) {
      this.options = deepMerge(
        this.options,
        deepCopy(languageSpecificOptions[this.ext])
      );
    }
    const pathparts = file.split('/');
    this.cwd = pathparts.slice(0, -1).join('/');
    this.src = pathparts.slice(-1).join('/');
    this.srcNoExt = this.src.slice(0, -this.ext.length);

    // check if folder is valid
    if (!fs.existsSync(this.cwd)) {
      throw new AgentDirectoryError(
        `${this.cwd} directory does not exist, check if directory provided through the file is correct`,
        this.id
      );
    }

    // check if file exists
    if (!fs.existsSync(file)) {
      throw new AgentFileError(
        `${file} does not exist, check if file path provided is correct`,
        this.id
      );
    }

    this.file = file;

    switch (this.ext) {
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
        this.cmd = '';
        break;
      default:
    }

    if (this.options.id !== null) {
      this.id = options.id;
    } else {
      throw new AgentMissingIDError(
        `No id provided for agent using ${file}`,
        this.id
      );
    }
    if (this.options.name) {
      this.name = this.options.name;
    } else {
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

  async setupContainer(
    name: string,
    docker: Dockerode,
    engineOptions: MatchEngine.EngineOptions
  ): Promise<void> {
    const HostConfig: HostConfig = {
      // apply seccomp profile for security
      SecurityOpt: [`seccomp=${DefaultSeccompProfileString}`],
    };
    if (engineOptions.memory.active) {
      HostConfig.Memory = engineOptions.memory.limit;
    }
    const container = await docker.createContainer({
      Image: this.options.image,
      name: name,
      OpenStdin: true,
      StdinOnce: true,
      HostConfig,
    });
    this.log.system(`Created container ${name}`);

    // store container
    this.container = container;
    await container.start();
    this.log.system(`Started container ${name}`);

    // copy bot directory into container
    await dockerCopy(this.cwd + '/.', name, '/code');
    this.log.system(`Copied bot into container ${name}`);
  }

  /**
   * Install whatever is needed through a `install.sh` file in the root of the bot folder
   */
  _install(
    stderrWritestream: Writable,
    stdoutWritestream: Writable,
    engineOptions: MatchEngine.EngineOptions
  ): Promise<void> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      // if there is a install.sh file, use it
      if (fs.existsSync(path.join(this.cwd, 'install.sh'))) {
        let stdout: Readable;
        let stderr: Readable;
        const installTimer = setTimeout(() => {
          const msg = 'Agent went over install time during the install stage\n';
          if (this.errorLogWriteStream) {
            this.errorLogWriteStream.write(msg);
          }
          reject(new AgentInstallTimeoutError(msg, this.id));
        }, this.options.maxInstallTime);

        const chunks = [];
        const handleClose = (code: number) => {
          clearTimeout(installTimer);
          if (code === 0) {
            resolve();
          } else {
            let msg = `A install time error occured. Install step for agent ${
              this.id
            } exited with code: ${code}; Installing ${path.join(
              this.cwd,
              'install.sh'
            )}; Install Output:\n${chunks.join('')}`;
            if (code === 137) {
              msg += `\nAgent likely ran out of memory, exceeded ${
                engineOptions.memory.limit / 1000000
              } MB`;
            }
            if (this.errorLogWriteStream) {
              this.errorLogWriteStream.write(msg + '\n');
            }
            reject(new AgentInstallError(msg, this.id));
          }
        };

        const handleError = (err: Error) => {
          clearTimeout(installTimer);
          reject(err);
        };

        if (this.options.secureMode) {
          try {
            const exec = await this.container.exec({
              Cmd: ['/bin/bash', '-c', 'chmod u+x install.sh'],
              WorkingDir: containerBotFolder,
            });
            await exec.start({});
            const data = await this.containerSpawn(
              path.join(containerBotFolder, 'install.sh')
            );
            stderr = data.err;
            stdout = data.out;
            data.stream.on('end', async () => {
              const endRes = await data.exec.inspect();
              handleClose(endRes.ExitCode);
            });
            data.stream.on('error', (err) => {
              handleError(err);
            });
          } catch (err) {
            handleError(err);
            return;
          }
        } else {
          const p = spawn('bash', ['install.sh'], {
            cwd: this.cwd,
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
      } else {
        resolve();
      }
    });
  }

  /**
   * Compile whatever is needed and validate files. Called by {@link MatchEngine} and has a timer set by the
   * maxCompileTime option in {@link Agent.Options}
   */
  async _compile(
    stderrWritestream: Writable,
    stdoutWritestream: Writable,
    engineOptions: MatchEngine.EngineOptions
  ): Promise<void> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      let p: ChildProcess | Agent.ContainerExecData;
      let stdout: Readable;
      let stderr: Readable;
      const compileTimer = setTimeout(() => {
        const msg = 'Agent went over compile time during the compile stage\n';
        if (this.errorLogWriteStream) {
          this.errorLogWriteStream.write(msg);
        }
        reject(new AgentCompileTimeoutError(msg, this.id));
      }, this.options.maxCompileTime);
      if (this.options.compileCommands[this.ext]) {
        const cmd1 = this.options.compileCommands[this.ext][0];
        const restofCmds = this.options.compileCommands[this.ext].slice(1);
        p = await this._spawnCompileProcess(cmd1, [...restofCmds, this.src]);
      } else {
        switch (this.ext) {
          case '.py':
          case '.php':
          case '.js':
            clearTimeout(compileTimer);
            resolve();
            return;
          case '.ts':
            // expect user to provide a tsconfig.json
            p = await this._spawnCompileProcess('tsc', []);
            break;
          case '.go':
            p = await this._spawnCompileProcess('go', [
              'build',
              '-o',
              `${this.srcNoExt}.out`,
              this.src,
            ]);
            break;
          case '.cpp':
            p = await this._spawnCompileProcess('g++', [
              '-std=c++11',
              '-O3',
              '-o',
              `${this.srcNoExt}.out`,
              this.src,
            ]);
            break;
          case '.c':
            p = await this._spawnCompileProcess('gcc', [
              '-O3',
              '-o',
              `${this.srcNoExt}.out`,
              this.src,
            ]);
            break;
          case '.java':
            p = await this._spawnCompileProcess('javac', [this.src]);
            break;
          default:
            reject(
              new NotSupportedError(
                `Language with extension ${this.ext} is not supported at the moment`
              )
            );
            break;
        }
      }
      const chunks = [];
      const handleClose = (code: number) => {
        clearTimeout(compileTimer);
        if (code === 0) {
          resolve();
        } else {
          let msg = `A compile time error occured. Compile step for agent ${
            this.id
          } exited with code: ${code}; Compiling ${
            this.file
          }; Compile Output:\n${chunks.join('')}`;
          if (code === 137) {
            msg += `\nAgent likely ran out of memory, exceeded ${
              engineOptions.memory.limit / 1000000
            } MB`;
          }
          if (this.errorLogWriteStream) {
            this.errorLogWriteStream.write(msg + '\n');
          }
          reject(new AgentCompileError(msg, this.id));
        }
      };
      const handleError = (err: Error) => {
        clearTimeout(compileTimer);
        reject(err);
      };
      if (isChildProcess(p)) {
        stdout = p.stdout;
        stderr = p.stderr;
        p.on('error', (err) => {
          handleError(err);
        });
        p.on('close', (code) => {
          handleClose(code);
        });
      } else {
        stdout = p.out;
        stderr = p.err;
        const containerExec = p.exec;
        p.stream.on('error', (err) => {
          handleError(err);
        });
        p.stream.on('end', async () => {
          const endRes = await containerExec.inspect();
          handleClose(endRes.ExitCode);
        });
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
    });
  }

  /**
   * Spawns the compilation process
   * @param command - command to compile with
   * @param args - argument for the compilation
   */
  async _spawnCompileProcess(
    command: string,
    args: Array<string>
  ): Promise<ChildProcess | Agent.ContainerExecData> {
    return new Promise((resolve, reject) => {
      if (this.options.secureMode) {
        this.containerSpawn(`${command} ${args.join(' ')}`, containerBotFolder)
          .then(resolve)
          .catch(reject);
      } else {
        const p = spawn(command, [...args], {
          cwd: this.cwd,
        }).on('error', (err) => {
          reject(err);
        });
        resolve(p);
      }
    });
  }

  /**
   * Executes the given command string in the agent's container and attaches stdin, stdout, and stderr accordingly
   * @param command - the command to execute in the container
   */
  async containerSpawn(
    command: string,
    workingDir = '/'
  ): Promise<Agent.ContainerExecData> {
    const exec = await this.container.exec({
      Cmd: ['/bin/bash', '-c', command],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: workingDir,
    });

    const stream = await exec.start({ stdin: true, hijack: true });
    const instream = new Stream.PassThrough();
    const outstream = new Stream.PassThrough();
    const errstream = new Stream.PassThrough();
    instream.pipe(stream);
    this.container.modem.demuxStream(stream, outstream, errstream);

    return {
      in: instream,
      out: outstream,
      err: errstream,
      stream,
      exec,
    };
  }

  /**
   * Spawn the process and return the process
   */
  async _spawn(): Promise<ChildProcess | Agent.ContainerExecData> {
    if (this.options.runCommands[this.ext]) {
      return this._spawnProcess(this.options.runCommands[this.ext][0], [
        ...this.options.runCommands[this.ext].slice(1),
        this.src,
      ]);
    } else {
      switch (this.ext) {
        case '.py':
        case '.js':
        case '.php': {
          const p = this._spawnProcess(this.cmd, [this.src]);
          return p;
        }
        case '.ts':
          return this._spawnProcess(this.cmd, [this.srcNoExt + '.js']);
        case '.java':
          return this._spawnProcess(this.cmd, [this.srcNoExt]);
        case '.c':
        case '.cpp':
        case '.go':
          return this._spawnProcess('./' + this.srcNoExt + '.out', []);
        default:
          throw new NotSupportedError(
            `Language with extension ${this.ext} is not supported yet`
          );
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
  _spawnProcess(
    command: string,
    args: Array<string>
  ): Promise<ChildProcess | Agent.ContainerExecData> {
    return new Promise((resolve, reject) => {
      if (this.options.secureMode) {
        this.containerSpawn(`${command} ${args.join(' ')}`, containerBotFolder)
          .then(resolve)
          .catch(reject);
      } else {
        const p = spawn(command, args, {
          cwd: this.cwd,
          detached: false,
        }).on('error', (err) => {
          reject(err);
        });
        resolve(p);
      }
    });
  }

  /**
   * Stop an agent provided it is not terminated. To terminate it, see {@link _terminate};
   */
  async stop(): Promise<void> {
    if (!this.isTerminated()) {
      if (this.options.secureMode) {
        await this.container.pause();
      } else {
        this.process.kill('SIGSTOP');
      }
      this.status = Agent.Status.STOPPED;
    }
  }

  /**
   * Resume an agent as long it is not terminated already
   */
  async resume(): Promise<void> {
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
  timeout(): void {
    if (this.errorLogWriteStream) {
      this.errorLogWriteStream.write('Agent timed out');
    }
    this.emit(Agent.AGENT_EVENTS.TIMEOUT);
  }

  /**
   * call out agent for exceeding memory limit
   */
  overMemory(): void {
    if (this.errorLogWriteStream) {
      this.errorLogWriteStream.write('Agent exceeded memory limit');
    }
    this.emit(Agent.AGENT_EVENTS.EXCEED_MEMORY_LIMIT);
  }

  /**
   * Whether or not input is destroyed
   */
  inputDestroyed(): boolean {
    return this.streams.in.destroyed;
  }

  /**
   * Write to stdin of the process associated with the agent
   * @param message - the message
   * @param callback - callback function
   */
  write(message: string, callback: (error: Error) => void): void {
    this.streams.in.write(message, callback);
  }

  /**
   * Get process of agent
   */
  _getProcess(): ChildProcess {
    return this.process;
  }

  /**
   * Store process for agent
   * @param p - process to store
   */
  _storeProcess(p: ChildProcess): void {
    this.process = p;
  }

  /**
   * Returns true if this agent was terminated and no longer send or receive emssages
   */
  isTerminated(): boolean {
    return this.status === Agent.Status.KILLED;
  }

  /**
   * Terminates this agent by stopping all related processes and remove any temporary directory. this is the only function allowed to
   * set the status value to killed.
   */
  _terminate(): Promise<void> {
    this.status = Agent.Status.KILLED;
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      if (this.options.secureMode) {
        if (this.container) {
          try {
            const ins = await this.container.inspect();
            this._clearTimer();
            clearInterval(this.memoryWatchInterval);
            if (ins.State.Running) {
              await this.container.kill();
              await this.container.remove();
            }
            resolve();
          } catch (err) {
            if (err.statusCode !== 409 && err.reason !== 'no such container') {
              reject(err);
            } else {
              resolve();
            }
          }
        } else {
          resolve();
        }
      } else {
        if (this.process) {
          treekill(this.process.pid, 'SIGKILL', (err) => {
            this._clearTimer();
            clearInterval(this.memoryWatchInterval);

            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        } else {
          resolve();
        }
      }
    });
  }

  /**
   * Disallow an agent from sending more commands
   */
  _disallowCommands(): void {
    this.allowedToSendCommands = false;
  }

  /**
   * Allow agent to send commands again
   */
  _allowCommands(): void {
    this.allowedToSendCommands = true;
  }

  /**
   * Check if agent is set to be allowed to send commands. The {@link EngineOptions} affect when this is flipped
   */
  isAllowedToSendCommands(): boolean {
    return this.allowedToSendCommands;
  }

  /**
   * Setup the agent timer clear out method
   */
  _setTimeout(fn: Function, delay: number, ...args: any[]): void {
    const timer = setTimeout(() => {
      fn(...args);
    }, delay);
    this._clearTimer = () => {
      clearTimeout(timer);
    };
  }

  /**
   * Stop this agent from more outputs and mark it as done for now and awaiting for updates
   */
  async _finishMove(): Promise<void> {
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
  _setupMove(): void {
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
   * Used by {@link MatchEngine} only. Setups the memory watcher if docker is not used.
   * @param engineOptions - engine options to configure the agent with
   */
  _setupMemoryWatcher(engineOptions: MatchEngine.EngineOptions): void {
    const checkAgentMemoryUsage = () => {
      // setting { maxage: 0 } because otherwise pidusage leaves interval "memory leaks" and process doesn't exit fast
      if (processIsRunning(this.process.pid)) {
        pidusage(this.process.pid, {
          maxage: 0,
          usePs: engineOptions.memory.usePs,
        })
          .then((stat) => {
            if (stat.memory > engineOptions.memory.limit) {
              this.overMemory();
            }
          })
          .catch((err) => {
            this.log.warn(err);
          });
      }
    };
    checkAgentMemoryUsage();
    this.memoryWatchInterval = setInterval(
      checkAgentMemoryUsage,
      engineOptions.memory.checkRate
    );
  }

  /**
   * Generates a list of agents for use
   * @param files List of files to use to make agents or a list of objects with a file key for the file path to the bot
   *              and a name key for the name of the agent
   * @param options - Options to first override with for all agents
   * @param languageSpecificOptions - Options to second overrided with for agents depending on language
   * @param agentSpecificOptions - Options to lastly override with depending on agent's index
   */
  static generateAgents(
    files:
      | Array<string>
      | Array<{ file: string; name?: string; tournamentID?: Tournament.ID }>,
    options: DeepPartial<Agent.Options>,
    languageSpecificOptions: Agent.LanguageSpecificOptions = {},
    agentSpecificOptions: Array<DeepPartial<Agent.Options>> = []
  ): Array<Agent> {
    if (files.length === 0) {
      throw new AgentFileError(
        'No files provided to generate agents with!',
        -1
      );
    }
    const agents: Array<Agent> = [];

    if (typeof files[0] === 'string') {
      files.forEach((file, index: number) => {
        let configs = deepCopy(options);
        configs = deepMerge(
          configs,
          deepCopy(
            agentSpecificOptions[index] ? agentSpecificOptions[index] : {}
          )
        );
        configs.id = index;
        agents.push(
          new Agent(file, <Agent.Options>configs, languageSpecificOptions)
        );
      });
    } else if (files[0].name !== undefined) {
      files.forEach((info, index: number) => {
        let configs = deepCopy(options);
        configs = deepMerge(
          configs,
          deepCopy(
            agentSpecificOptions[index] ? agentSpecificOptions[index] : {}
          )
        );
        configs.id = index;
        configs.name = info.name;
        agents.push(
          new Agent(info.file, <Agent.Options>configs, languageSpecificOptions)
        );
      });
    } else {
      files.forEach((info, index: number) => {
        let configs = deepCopy(options);
        configs = deepMerge(
          configs,
          deepCopy(
            agentSpecificOptions[index] ? agentSpecificOptions[index] : {}
          )
        );
        configs.id = index;
        configs.tournamentID = info.tournamentID;
        agents.push(
          new Agent(info.file, <Agent.Options>configs, languageSpecificOptions)
        );
      });
    }
    return agents;
  }

  getAgentErrorLogFilename(): string {
    return `agent_${this.id}.log`;
  }
}

export namespace Agent {
  /**
   * Stream data for any process
   */
  export interface Streams {
    in: Writable;
    out: Readable;
    err: Readable;
  }

  /**
   * data related to executing a command in a container, with stream data, and the exec object
   */
  export interface ContainerExecData extends Streams {
    exec: Dockerode.Exec;
    stream: Duplex;
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
    STOPPED = 'stopped',
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
    name: string;

    /**
     * Whether or not to spawn agent securely and avoid malicious activity
     *
     * When set to true, the agent's file and the directory containing the file are copied over to a temporary directory
     * of which there is restricted access. By default this is false
     *
     * @default `false` (always inherited from the match configs, see {@link Match.Configs})
     */
    secureMode: boolean;

    /** A specified ID to use for the agent */
    id: ID;

    /** A specified tournament ID linking an agent to the {@link Tournament} and {@link Player} it belongs to */
    tournamentID: Tournament.ID;

    /** Logging level of this agent */
    loggingLevel: Logger.LEVEL;

    /**
     * Maximium time allowed for an agent to spend on the installing step
     * @default 5 minutes (300,000 ms)
     */
    maxInstallTime: number;

    /**
     * Maximum time allowed to be spent compiling
     * @default 1 minute (60,000 ms)
     */
    maxCompileTime: number;

    /**
     * Map from extension type to set of commands used to compile this agent instead of the defaults. When there is no
     * mapping default is used
     *
     * @default `null`
     */
    compileCommands: { [x in string]: Array<string> };

    /**
     * Map from extension type to set of commands used to run this agent instead of the defaults. When there is no
     * mapping default is used
     *
     * @default `null`
     */
    runCommands: { [x in string]: Array<string> };

    /**
     * Image to use for docker container if Agent is being run in secureMode. The default is a standard image provided
     * by Dimensions that has all supported languages built in so agents can use them. The requirement for these images
     * is that they have bash installed.
     *
     * It is highly recommended
     * to use the {@link Match.Configs.languageSpecificAgentOptions} field and set specific images for each programming
     * language in a production environment to reduce overhead caused by docker.
     *
     * @default `docker.io/stonezt2000/dimensions_langs`
     */
    image: string;

    /**
     * Whether or not to try and use a cached bot file. This is only relevant if a storage service is used as it helps
     * reduce the number of times a bot file is downloaded.
     *
     * @default `false`
     */
    useCachedBotFile: boolean;
  }

  export type LanguageSpecificOptions = {
    [x in string]?: DeepPartial<Agent.Options>;
  };

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
    CLOSE = 'close',
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
    compileCommands: {},
    image: 'docker.io/stonezt2000/dimensions_langs',
    useCachedBotFile: false,
  };
}
