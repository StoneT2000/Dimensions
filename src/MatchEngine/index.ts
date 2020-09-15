import os from 'os';
import { spawn, ChildProcess, exec } from 'child_process';
import fs, { WriteStream } from 'fs';
import path from 'path';

// Import utilities
import { deepCopy } from '../utils/DeepCopy';
import { DeepPartial } from '../utils/DeepPartial';
import { deepMerge } from '../utils/DeepMerge';

import {
  AgentNotHandlingInputError,
  FatalError,
  MatchError,
  NotSupportedError,
} from '../DimensionError';

import { Design } from '../Design';
import { Logger } from '../Logger';
import { Agent } from '../Agent';
import { Match } from '../Match';
import Dockerode from 'dockerode';
import { isChildProcess } from '../utils/TypeGuards';
import { noop } from '../utils';

/** @ignore */
type EngineOptions = MatchEngine.EngineOptions;

/**
 * The Match Engine that takes a {@link Design} and its specified {@link EngineOptions} to form the backend
 * for running matches with agents.
 */
export class MatchEngine {
  /** The design the engine runs on */
  private design: Design;

  /** Engine options */
  private engineOptions: EngineOptions;

  /** Override options */
  private overrideOptions: Design.OverrideOptions;

  /** Logger */
  private log = new Logger();

  /**
   * A coordination signal to ensure that all processes are indeed killed due to asynchronous initialization of agents
   * There is a race condition when a tournament/match is being destroyed and while every match is being destroyed, some
   * matches are in the initialization stage where they call the engine's initialize function. As a result, when we
   * send a match destroy signal, we spawn some processes and haven't spawned some others for the agents. As a result,
   * all processes eventually get spawned but not all are cleaned up and killed.
   */
  killOffSignal = false;

  /** approx extra buffer time given to agents due to engine processing for timeout mechanism */
  static timeoutBuffer = 25;

  private docker: Dockerode;

  /**
   * Single memory watch interval so that all memory checks are made together
   */
  private memoryWatchInterval = null;

  /**
   * Match engine constructor
   * @param design - the design to use
   * @param loggingLevel - the logging level for this engine
   */
  constructor(design: Design, loggingLevel: Logger.LEVEL) {
    this.design = design;
    this.engineOptions = deepCopy(this.design.getDesignOptions().engineOptions);
    this.overrideOptions = deepCopy(this.design.getDesignOptions().override);
    this.log.identifier = `Engine`;
    this.setLogLevel(loggingLevel);
    this.docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
  }

  /** Set log level */
  setLogLevel(loggingLevel: Logger.LEVEL): void {
    this.log.level = loggingLevel;
  }
  /** Get the engine options */
  getEngineOptions(): EngineOptions {
    return this.engineOptions;
  }
  /** Set the engine options */
  setEngineOptions(newOptions: DeepPartial<EngineOptions> = {}): void {
    this.engineOptions = deepMerge(this.engineOptions, newOptions);
  }

  /**
   * Starts up the engine by intializing processes for all the agents and setting some variables for a match
   * @param agents - The agents involved to be setup for the given match
   * @param match - The match to initialize
   * @returns a promise that resolves once succesfully initialized
   */
  async initialize(agents: Array<Agent>, match: Match): Promise<void> {
    this.log.systembar();

    const agentSetupPromises: Array<Promise<void>> = [];

    match.agents.forEach((agent: Agent) => {
      agentSetupPromises.push(this.initializeAgent(agent, match));
    }, this);

    await Promise.all(agentSetupPromises);

    this.log.system('FINISHED INITIALIZATION OF PROCESSES\n');
    return;
  }

  /**
   * Initializes a single agent, called by {@link initialize}
   * @param agent - agent to initialize
   * @param match - match to initialize in
   */
  private async initializeAgent(agent: Agent, match: Match): Promise<void> {
    this.log.system(
      'Setting up and spawning ' +
        agent.name +
        ` | Command: ${agent.cmd} ${agent.src}`
    );

    // create container in secureMode
    if (match.configs.secureMode) {
      const name = `${match.id}_agent_${agent.id}`;
      await agent.setupContainer(name, this.docker, this.engineOptions);
    }

    if (this.engineOptions.memory.active) {
      if (agent.options.secureMode) {
        // await agent._setupMemoryWatcherOnContainer(this.engineOptions);
      }
    }
    // note to self, do a Promise.all for each stage before going to the next, split initializeAgent into
    // initializeAgentCompile, initializeAgentInstall, initializeAgentSpawn....

    const errorLogFilepath = path.join(
      match.getMatchErrorLogDirectory(),
      agent.getAgentErrorLogFilename()
    );
    let errorLogWriteStream: WriteStream = null;

    if (match.configs.storeErrorLogs) {
      errorLogWriteStream = fs.createWriteStream(errorLogFilepath);
      agent.errorLogWriteStream = errorLogWriteStream;
      errorLogWriteStream.write('=== Agent Install Log ===\n');
    }

    // wait for install step
    await agent._install(
      errorLogWriteStream,
      errorLogWriteStream,
      this.engineOptions
    );
    this.log.system('Succesfully ran install step for agent ' + agent.id);

    if (match.configs.storeErrorLogs) {
      errorLogWriteStream.write('=== Agent Compile Log ===\n');
    }
    // wait for compilation step
    await agent._compile(
      errorLogWriteStream,
      errorLogWriteStream,
      this.engineOptions
    );
    this.log.system('Succesfully ran compile step for agent ' + agent.id);

    let p: ChildProcess | Agent.ContainerExecData = null;

    p = await agent._spawn();
    this.log.system('Spawned agent ' + agent.id);
    if (isChildProcess(p)) {
      // store process and streams
      agent._storeProcess(p);
      agent.streams.in = p.stdin;
      agent.streams.out = p.stdout;
      agent.streams.err = p.stderr;

      p.on('close', (code) => {
        agent.emit(Agent.AGENT_EVENTS.CLOSE, code);
      });

      // we do not care if input stream is broken, engine will detect this error through timeouts and what not
      agent.streams.in.on('error', noop);
    } else {
      // store streams
      agent.streams.in = p.in;
      agent.streams.out = p.out;
      agent.streams.err = p.err;

      const containerExec = p.exec;

      p.stream.on('end', async () => {
        const endRes = await containerExec.inspect();
        agent.emit(Agent.AGENT_EVENTS.CLOSE, endRes.ExitCode);
      });
    }

    // add listener for memory limit exceeded
    agent.on(Agent.AGENT_EVENTS.EXCEED_MEMORY_LIMIT, () => {
      this.engineOptions.memory.memoryCallback(
        agent,
        match,
        this.engineOptions
      );
    });

    // add listener for timeouts
    agent.on(Agent.AGENT_EVENTS.TIMEOUT, () => {
      this.engineOptions.timeout.timeoutCallback(
        agent,
        match,
        this.engineOptions
      );
    });

    match.idToAgentsMap.set(agent.id, agent);

    // set agent status as running
    agent.status = Agent.Status.RUNNING;

    // handler for stdout of Agent processes. Stores their output commands and resolves move promises
    agent.streams.out.on('readable', () => {
      let data: Array<string>;
      while ((data = agent.streams.out.read())) {
        // split chunks into line by line and handle each line of commands
        const strs = `${data}`.split('\n');

        // first store data into a buffer and process later if no newline character is detected

        // if final char in the strs array is not '', then \n is not at the end
        const endsWithNewline = strs[strs.length - 1] === '';
        // if strs when split up by \n, is greater than one in length, must have at least 1 newline char
        const agentOutputContainsNewline = strs.length > 1;

        if (agentOutputContainsNewline) {
          // if there is a newline, take whatever was stored in the buffer and
          // concat it with the output before the newline as they are part of the same line of commands
          strs[0] = agent._buffer.join('').concat(strs[0]);
          agent._buffer = [];
        }

        // handle each complete line of commands
        for (let i = 0; i < strs.length - 1; i++) {
          if (strs[i] === '') continue; // skip empty lines caused by adjacent \n chars
          // handle commands from this agent provided it is allowed to send commands
          if (agent.isAllowedToSendCommands()) {
            this.handleCommand(agent, strs[i]);
          }
        }

        // push final command that didn't have a newline into buffer
        if (
          this.engineOptions.commandLines.waitForNewline &&
          strs.length >= 1 &&
          !endsWithNewline
        ) {
          agent._buffer.push(strs[strs.length - 1]);
        }
      }
    });

    // log stderr from agents to this stderr if option active
    if (!this.engineOptions.noStdErr) {
      agent.streams.err.on('data', (data) => {
        this.log.error(`${agent.id}: ${data.slice(0, data.length - 1)}`);
      });
    }

    // pipe stderr of agent process to error log file if enabled
    if (match.configs.storeErrorLogs) {
      errorLogWriteStream.write('=== Agent Error Log ===\n');
      agent.streams.err.pipe(errorLogWriteStream);
    }

    // when process closes, print message
    agent.on(Agent.AGENT_EVENTS.CLOSE, (code) => {
      // terminate agent with engine kill if it hasn't been marked as terminated yet, indicating process likely exited
      // prematurely
      if (!agent.isTerminated()) {
        // if secureMode, agent wasn't terminated yet, and container exited prematurely with 137, it likely had an OOM error
        if (agent.options.secureMode && code === 137) {
          this.kill(
            agent,
            'agent closed but agent not terminated yet, likely exceeded memory'
          );
          this.engineOptions.memory.memoryCallback(
            agent,
            match,
            this.engineOptions
          );
        } else {
          this.kill(agent, 'agent closed but agent not terminated yet');
        }
      }
      this.log.system(
        `${agent.name} | id: ${agent.id} - exited with code ${code}`
      );
    });

    if (this.engineOptions.memory.active) {
      if (!agent.options.secureMode) {
        agent._setupMemoryWatcher(this.engineOptions);
      }
    }

    // this is for handling a race condition explained in the comments of this.killOffSignal
    // Briefly, sometimes agent process isn't stored yet during initialization and doesn't get killed as a result
    if (this.killOffSignal) {
      this.kill(
        agent,
        'engine has killOffSignal on, killing agent during initialization'
      );
    }
  }

  /**
   * Handles partial stdout from an agent
   * @param agent - the agent to process the command for
   * @param str - the string the agent sent
   */
  private async handleCommand(agent: Agent, str: string) {
    // TODO: Implement parallel command stream type
    if (
      this.engineOptions.commandStreamType ===
      MatchEngine.COMMAND_STREAM_TYPE.SEQUENTIAL
    ) {
      // IF SEQUENTIAL, we wait for each unit to finish their move and output their commands

      switch (this.engineOptions.commandFinishPolicy) {
        case MatchEngine.COMMAND_FINISH_POLICIES.FINISH_SYMBOL:
          // if we receive the symbol representing that the agent is done with output and now awaits for updates
          if (`${str}` === this.engineOptions.commandFinishSymbol) {
            await agent._finishMove();
          } else {
            agent.currentMoveCommands.push(str);
          }
          break;
        case MatchEngine.COMMAND_FINISH_POLICIES.LINE_COUNT:
          // if we receive the finish symbol, we mark agent as done with output (finishes their move prematurely)
          if (`${str}` === this.engineOptions.commandFinishSymbol) {
            await agent._finishMove();
          }
          // only log command if max isnt reached
          else if (
            agent.currentMoveCommands.length <
            this.engineOptions.commandLines.max - 1
          ) {
            agent.currentMoveCommands.push(str);
          }
          // else if on final command before reaching max, push final command and resolve
          else if (
            agent.currentMoveCommands.length ==
            this.engineOptions.commandLines.max - 1
          ) {
            await agent._finishMove();
            agent.currentMoveCommands.push(str);
          }
          break;
        case MatchEngine.COMMAND_FINISH_POLICIES.CUSTOM:
          // TODO: Not implemented yet
          throw new NotSupportedError(
            'Custom command finish policies are not allowed yet'
          );
          break;
      }
    }
    // else if (this.engineOptions.commandStreamType === COMMAND_STREAM_TYPE.PARALLEL) {
    //   // If PARALLEL, theres no waiting, we store commands immediately and resolve right away after each command
    //   agent.currentMoveResolve();
    //   // updates to match are first come first serve
    // }
  }

  /**
   * Attempts to gracefully and synchronously stop a match's agents
   * @param match - the match to stop
   */
  public async stop(match: Match): Promise<void> {
    const stopPromises: Array<Promise<void>> = [];
    match.agents.forEach((agent) => {
      stopPromises.push(agent.stop());
    });
    await Promise.all(stopPromises);
    this.log.system('Stopped all agents');
  }

  /**
   * Attempts to gracefully and synchronously resume a previously stopped match
   * @param match - the match to resume
   */
  public async resume(match: Match): Promise<void> {
    const resumePromises: Array<Promise<void>> = [];
    match.agents.forEach((agent) => {
      resumePromises.push(agent.resume());
    });
    await Promise.all(resumePromises);
    this.log.system('Resumed all agents');
  }

  /**
   * Kills all intervals and agents and processes from a match and cleans up. Kills any game processes as well. Shouldn't be used
   * for custom design based matches. Called by {@link Match}
   *
   * @param match - the match to kill all agents in and clean up
   */
  public async killAndClean(match: Match): Promise<void> {
    // set to true to ensure no more processes are being spawned.
    this.killOffSignal = true;
    clearInterval(this.memoryWatchInterval);
    const cleanUpPromises: Array<Promise<any>> = [];
    if (match.agents) {
      match.agents.forEach((agent) => {
        cleanUpPromises.push(this.kill(agent, 'cleanup'));
      });
    }
    await Promise.all(cleanUpPromises);
  }

  /**
   * Kills an agent and closes the process, and no longer attempts to receive coommands from it anymore
   * @param agent - the agent to kill off
   */
  public async kill(agent: Agent, reason = 'unspecified'): Promise<void> {
    try {
      await agent._terminate();
      this.log.system(
        `Killed off agent ${agent.id} - ${agent.name}`,
        `Reason: ${reason}`
      );
    } catch (err) {
      this.log.error('This should not happen when terminating agents.', err);
    }
    agent._currentMoveResolve();
  }

  /**
   * Returns a promise that resolves with all the commands loaded from the previous time step of the provided match
   * This coordinates all the Agents and waits for each one to finish their step
   * @param match - The match to get commands from agents for
   * @returns a promise that resolves with an array of {@link MatchEngine.Command} elements, holding the command and id
   * of the agent that sent it
   */
  public getCommands(match: Match): Promise<Array<MatchEngine.Command>> {
    return new Promise((resolve) => {
      const commands: Array<MatchEngine.Command> = [];
      const nonTerminatedAgents = match.agents.filter((agent: Agent) => {
        return !agent.isTerminated();
      });
      const allAgentMovePromises = nonTerminatedAgents.map((agent: Agent) => {
        return agent._currentMovePromise;
      });
      Promise.all(allAgentMovePromises).then(() => {
        this.log.system(`All move promises resolved`);
        match.agents.forEach((agent: Agent) => {
          // TODO: Add option to store sets of commands delimited by '\n' for an Agent as different sets of commands
          // for that Agent. Default right now is store every command delimited by the delimiter

          // for each set of commands delimited by '\n' in stdout of process, split it by delimiter and push to
          // commands
          agent.currentMoveCommands.forEach((commandString) => {
            commandString
              .split(this.engineOptions.commandDelimiter)
              .forEach((c) => {
                // we don't accept '' as commands.
                if (c !== '') {
                  commands.push({ command: c, agentID: agent.id });
                }
              });
          });
        });

        this.log.systemIO(
          `Agent commands at end of time step ${
            match.timeStep
          } to be sent to match on time step ${match.timeStep + 1} `
        );
        this.log.systemIO(
          commands.length ? JSON.stringify(commands) : 'No commands'
        );
        resolve(commands);
      });
    });
  }

  /**
   * Sends a message to a particular process governed by an agent in a specified match specified by the agentID
   * @param match - the match to work with
   * @param message - the message to send to agent's stdin
   * @param agentID - id that specifies the agent in the match to send the message to
   */
  public send(
    match: Match,
    message: string,
    agentID: Agent.ID
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const agent = match.idToAgentsMap.get(agentID);
      if (!agent.inputDestroyed() && !agent.isTerminated()) {
        const bufferReachedHighWaterMark = agent.write(
          `${message}\n`,
          (error: Error) => {
            if (error) reject(error);
            resolve(true);
          }
        );
        if (!bufferReachedHighWaterMark) {
          reject(
            new AgentNotHandlingInputError(
              'Input stream buffer highWaterMark reached, agent is not processing input',
              agentID
            )
          );
        }
      } else {
        this.log.error(
          `Agent ${agentID} - ${agent.name} - has been killed off already, can't send messages now`
        );
        resolve(false);
      }
    });
  }

  /**
   * @param match - The match to initialize with a custom design
   */
  async initializeCustom(): Promise<boolean> {
    // TODO: Initialize a custom design based match and run through some basic security measures
    return true;
  }

  /**
   * Run a custom match. A custom match much print to stdout all relevant data to be used by the engine and
   * Dimensions framework. All output after the conclude command from {@link Design.OverrideOptions} is outputted
   * is stored as a list of new line delimited strings and returned as the match results. The match must exit with
   * exit code 0 to be marked as succesfully complete and the processing of results stops and this function resolves
   * @param match - the match to run
   */
  public runCustom(match: Match): Promise<Array<string>> {
    return new Promise((resolve, reject) => {
      if (this.overrideOptions.active == false) {
        reject(
          new FatalError(
            'Override was not set active! Make sure to set the overide.active field to true'
          )
        );
      }
      const cmd = this.overrideOptions.command;

      const parsed = this.parseCustomArguments(
        match,
        this.overrideOptions.arguments
      );

      // spawn the match process with the parsed arguments
      let matchProcessTimer: any;

      // TODO: configure some kind of secureMode for custom matches

      match.matchProcess = spawn(cmd, parsed).on('error', (err) => {
        if (err) throw err;
      });
      this.log.system(
        `${match.name} | id: ${match.id} - spawned: ${cmd} ${parsed.join(' ')}`
      );

      const errorLogFilepath = path.join(
        match.getMatchErrorLogDirectory(),
        `match_error.log`
      );
      let errorLogWriteStream: WriteStream = null;

      if (match.configs.storeErrorLogs) {
        errorLogWriteStream = fs.createWriteStream(errorLogFilepath);
      }

      // pipe stderr of match process to error log file if enabled
      if (match.configs.storeErrorLogs) {
        errorLogWriteStream.write('=== Custom Match Error Log ===\n');
        match.matchProcess.stderr.pipe(errorLogWriteStream);
      }

      let matchTimedOut = false;
      // set up timer if specified
      if (this.overrideOptions.timeout !== null) {
        matchProcessTimer = setTimeout(() => {
          this.log.system(`${match.name} | id: ${match.id} - Timed out`);
          match.matchProcess.kill('SIGKILL');
          matchTimedOut = true;
        }, this.overrideOptions.timeout);
      }

      let processingStage = false;
      match.matchProcess.stdout.on('readable', () => {
        let data: string[];
        while ((data = match.matchProcess.stdout.read())) {
          // split chunks into line by line and handle each line of output
          const strs = `${data}`.split('\n');
          for (let i = 0; i < strs.length; i++) {
            const str = strs[i];

            // skip empties
            if (str === '') continue;

            // if we reached conclude command, default being D_MATCH_FINISHED, we start the processing stage
            if (str === this.overrideOptions.conclude_command) {
              processingStage = true;
            }
            // else if we aren't in the processing stage
            else if (!processingStage) {
              // store all stdout
              match.state.matchOutput.push(str);
            }
            // otherwise we are in processing stage
            else {
              // store into results
              match.results.push(str);
            }
          }
        }
      });

      match.matchProcess.stdout.on('close', (code) => {
        this.log.system(
          `${match.name} | id: ${match.id} - exited with code ${code}`
        );
        if (matchTimedOut) {
          reject(new MatchError('Match timed out'));
        } else {
          clearTimeout(matchProcessTimer);
          resolve(match.results);
        }
        // remove the agent files if on secureMode and double check it is the temporary directory
        match.agents.forEach((agent) => {
          if (agent.options.secureMode) {
            const tmpdir = os.tmpdir();
            if (agent.cwd.slice(0, tmpdir.length) === tmpdir) {
              exec(`sudo rm -rf ${agent.cwd}`);
            } else {
              this.log.error(
                "couldn't remove agent files while in secure mode"
              );
            }
          }
        });
      });
    });
  }

  /**
   * Attempts to stop a {@link Match} based on a custom {@link Design}
   * @param match - the match to stop
   */
  public async stopCustom(match: Match): Promise<void> {
    // attempt to stop the match
    match.matchProcess.kill('SIGSTOP');
    // TODO: stop the match process timer
  }

  /**
   * Attempts to resume a {@link Match} based on a custom {@link Design}
   * @param match - the match to resume
   */
  public async resumeCustom(match: Match): Promise<void> {
    // attempt to resume the match
    match.matchProcess.kill('SIGCONT');
  }

  /**
   * Attempts to kill and clean up anything else for a custom design based match
   * @param match - the match to kill and clean up
   */
  public async killAndCleanCustom(match: Match): Promise<void> {
    if (match.matchProcess) match.matchProcess.kill('SIGKILL');
  }

  /**
   * Parses a list of arguments for a given match and populates relevant strings as needed
   * @param match - the match to parse arguments for
   * @param args - the arguments to parse
   */
  private parseCustomArguments(
    match: Match,
    args: Array<string | MatchEngine.DynamicDataStrings>
  ): Array<string> {
    if (match.matchStatus === Match.Status.UNINITIALIZED) {
      throw new FatalError(
        `Match ${match.id} - ${match.name} is not initialized yet`
      );
    }

    const parsed = [];

    for (let i = 0; i < args.length; i++) {
      switch (args[i]) {
        case MatchEngine.DynamicDataStrings.D_FILES:
          match.agents.forEach((agent) => {
            parsed.push(agent.file);
          });
          break;
        case MatchEngine.DynamicDataStrings.D_TOURNAMENT_IDS:
          match.agents.forEach((agent) => {
            // pass in tournament ID string if it exists, otherwise pass in 0
            parsed.push(agent.tournamentID.id ? agent.tournamentID : '0');
          });
          break;
        case MatchEngine.DynamicDataStrings.D_AGENT_IDS:
          match.agents.forEach((agent) => {
            parsed.push(agent.id);
          });
          break;
        case MatchEngine.DynamicDataStrings.D_MATCH_ID:
          parsed.push(match.id);
          break;
        case MatchEngine.DynamicDataStrings.D_MATCH_NAME:
          parsed.push(match.name);
          break;
        case MatchEngine.DynamicDataStrings.D_NAMES:
          match.agents.forEach((agent) => {
            let parsedName = agent.name;
            parsedName = parsedName.replace(/\//g, '-');
            parsedName = parsedName.replace(/ /g, '_');
            parsed.push(parsedName);
          });
          break;
        default:
          parsed.push(args[i]);
          break;
      }
    }

    return parsed;
  }

  /**
   * Returns the logger for this match engine
   */
  public getLogger(): Logger {
    return this.log;
  }
}

export namespace MatchEngine {
  /**
   * Various policies available that describe the requirements before an agent is marked as done with sending commands
   * at some time step
   */
  export enum COMMAND_FINISH_POLICIES {
    /**
     * Agent's finish their commands by sending a finish symbol, namely {@link EngineOptions.commandFinishSymbol}
     */
    FINISH_SYMBOL = 'finish_symbol',

    /**
     * Agent's finish their commands by either sending a finish symmbol or after they send
     * {@link EngineOptions.commandLines.max} lines
     */
    LINE_COUNT = 'line_count',
    /**
     * Custom finishing policy provided by user. Not allowed at the moment
     */
    CUSTOM = 'custom',
    // TODO: implement custom finish policy
  }

  /**
   * Engine Options that specify how the {@link MatchEngine} should operate on a {@link Match}
   */
  export interface EngineOptions {
    /** The command streaming type */
    commandStreamType: MatchEngine.COMMAND_STREAM_TYPE;
    /**
     * Delimiter for seperating commands from agents in their stdout and then sending these delimited commands to
     * {@link Design.update}. If an agent sent `move a b 3,run 24 d,t 3` and the delimiter is `','` then the
     * {@link Design.update} function will receive commands `'move a b 3'` and `'run 24 d'` and `'t 3'`
     * @default ','
     */
    commandDelimiter: string;
    /**
     * The finish symbol to use
     * @default 'D_FINISH'
     */
    commandFinishSymbol: string;
    /**
     * Which kind of command finishing policy to use
     * @default 'finish_symbol'
     */
    commandFinishPolicy: MatchEngine.COMMAND_FINISH_POLICIES;
    /**
     * Options for the {@link COMMAND_FINISH_POLICIES.LINE_COUNT} finishing policy. Used only if this policy is active
     */
    commandLines: {
      /**
       * Maximum lines of commands delimited by new line characters '\n' allowed before engine cuts off an Agent
       * @default 1
       */
      max: number;
      /**
       * Whether the engine should wait for a newline character before processing the line of commands received
       * This should for most cases be set to `true`; false will lead to some unpredictable behavior.
       * @default true
       */
      waitForNewline: boolean;
    };

    /**
     * Whether agents output to standard error is logged by the matchengine or not
     *
     * It's suggested to let agent output go to a file.
     *
     * @default true
     */
    noStdErr: boolean;

    /**
     * Options for timeouts of agents
     */
    timeout: {
      /**
       * On or not
       * @default true
       */
      active: boolean;
      /**
       * How long in milliseconds each agent is given before they are timed out and the timeoutCallback
       * function is called
       * @default 1000
       */
      max: number;
      /**
       * the callback called when an agent times out.
       * Default is kill the agent with {@link Match.kill}.
       */
      timeoutCallback: /**
       * @param agent the agent that timed out
       * @param match - the match the agent timed out in
       * @param engineOptions - a copy of the engineOptions used that timed out the agent
       */
      (agent: Agent, match: Match, engineOptions: EngineOptions) => void;
    };

    /**
     * Options related to the memory usage of agents. The memoryCallback is called when the limit is reached
     */
    memory: {
      /**
       * Whether or not the engine will monitor the memory use
       * @default true
       */
      active: boolean;

      /**
       * Maximum number of bytes an agent can use before the memoryCallback is called
       * @default 1 GB (1,000,000,000 bytes)
       */
      limit: number;

      /**
       * The callback called when an agent raeches the memory limit
       * Default is kill the agent with {@link Match.kill}
       */
      memoryCallback: /**
       * @param agent the agent that reached the memory limit
       * @param match - the match the agent was in
       * @param engineOptions - a copy of the engineOptions used in the match
       */
      (agent: Agent, match: Match, engineOptions: EngineOptions) => void;

      /**
       * How frequently the engine checks the memory usage of an agent in milliseconds
       * @default 100
       */
      checkRate: number;

      /**
       * Whether or not to use `ps` instead of `procfile` for measuring memory through the
       * pidusage package.
       *
       * @default true
       */
      usePs: boolean;
    };
  }

  /** Standard ways for commands from agents to be streamed to the MatchEngine for the {@link Design} to handle */
  export enum COMMAND_STREAM_TYPE {
    /** First come first serve for commands run. Not implemented */
    PARALLEL = 'parallel',
    /** Each agent's set of commands is run before the next agent */
    SEQUENTIAL = 'sequential',
  }
  /**
   * A command delimited by the delimiter of the match engine from all commands sent by agent specified by agentID
   */
  export interface Command {
    /**
     * The string command received
     */
    command: string;
    /**
     * The id of the agent that sent this command
     */
    agentID: Agent.ID;
  }

  /**
   * Dynammic Data strings are strings in the {@link OverrideOptions} arguments array that are automatically replaced
   * with dynamic data as defined in the documentation of these enums
   */
  export enum DynamicDataStrings {
    /**
     * `D_FILES` is automatically populated by a space seperated string list of the file paths provided for each of the
     * agents competing in a match.
     *
     * NOTE, these paths don't actually need to be files, they can be directories or anything that works with
     * your own command and design
     *
     * @example Suppose the paths to the sources the agents operate on are `path1`, `path2`, `path3`. Then `D_FILES`
     * will be passed into your command as `path1 path2 path3`
     */
    D_FILES = 'D_FILES',

    /**
     * `D_AGENT_IDS` is automatically populated by a space seperated string list of the agent IDs of every agent being
     * loaded into a match in the same order as D_FILES. This should always be sorted by default as agents are loaded
     * in order from agent ID `0` to agent ID `n-1`in a `n` agent match
     *
     * @example Suppose a match is running with agents with IDs `0, 1, 2, 3`. Then `D_AGENT_IDS` will be passed into
     * your command as `0 1 2 3`
     */
    D_AGENT_IDS = 'D_AGENT_IDS',

    /**
     * `D_TOURNAMENT_IDS` is automatically populated by a space seperated string list of the tournament ID numbers of
     * the agents being loaded into the match in the same order. If no tournament is being run all the ID numbers will
     * default to 0 but still be passed in to the command you give for the override configurations
     *
     * @example Suppose a match in a tournament is running 2 agents with tournament IDs `Qb6NyTxufGGU`, `EGg3tSN2KUgl`
     * Then `D_TOURNAMENT_IDS` will be passed into your command as `Qb6NyTxufGGU EGg3tSN2KUgl`
     */
    D_TOURNAMENT_IDS = 'D_TOURNAMENT_IDS',

    /**
     * D_MATCH_ID is automatically replaced with the id of the match being run
     *
     * @example Suppose the match has ID `eF1uEacgfgMm`, then `D_MATCH_ID` is passed into your command as `eF1uEacgfgMm`
     */
    D_MATCH_ID = 'D_MATCH_ID',

    /**
     * D_MATCH_NAME is automatically replaced with the name of the match being run
     *
     * @example Suppose the match has name 'my_match'. Then `D_MATCH_NAME` is passed into your commnad as `my_match`
     */
    D_MATCH_NAME = 'D_MATCH_NAME',

    /**
     * D_NAMES is automatically replaced with the names of the agents
     *
     * @example Suppose the agents 0 and 1 had names `bob, richard`. Then `D_NAMES` is passed into your command as
     * `bob richard`
     */
    D_NAMES = 'D_NAMES',
  }
}
