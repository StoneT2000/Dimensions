import { FatalError, MatchError, NotSupportedError } from "../DimensionError";
import { DeepPartial } from "../utils/DeepPartial";
import { deepMerge } from "../utils/DeepMerge";
import { Design } from '../Design';
import { Design as DesignTypes } from '../Design/types';
import { Logger } from '../Logger';
import os from 'os';
import { Agent } from '../Agent';
import { Match } from '../Match';
import { deepCopy } from '../utils/DeepCopy';
import { spawn, ChildProcess, exec } from 'child_process';
import { EngineOptions as EngineOptionsAlias } from './engineOptions';

type EngineOptions = EngineOptionsAlias;

import DDS = DesignTypes.DynamicDataStrings;
/**
 * @class MatchEngine
 * @classdesc The Match Engine that takes a {@link Design} and starts matches by spawning new processes for each 
 * {@link Agent}.
 * 
 * Functionally runs matches as storing the match causes circular problems 
 * (previously Match has Engine, Engine has Match)
 */
export class MatchEngine {

  // The design the MatchEngine runs on
  private design: Design;

  /** Engine options */
  private engineOptions: EngineOptions;
  
  /** Override options */
  private overrideOptions: DesignTypes.OverrideOptions;

  /** Logger */
  private log = new Logger();

  /** 
   * A coordination signal to ensure that all processes are indeed killed due to asynchronous initialization of agents
   * There is a race condition when a tournament/match is being destroyed and while every match is being destroyed, some
   * matches are in the initialization stage where they call the engine's initialize function. As a result, when we 
   * send a match destroy signal, we spawn some processes and haven't spawned some others for the agents. As a result, 
   * all processes eventually get spawned but not all are cleaned up and killed.
   */
  private killOffSignal = false;
  
  // approx extra buffer time given to agents due to engine processing for timeout mechanism
  static timeoutBuffer: number = 25; 
  
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
  }

  /** Set log level */
  setLogLevel(loggingLevel: Logger.LEVEL) {
    this.log.level = loggingLevel;
  }
  /** Get the engine options */
  getEngineOptions() {
    return this.engineOptions;
  }
  /** Set the engine options */
  setEngineOptions(newOptions: DeepPartial<EngineOptions> = {}) {
    this.engineOptions = deepMerge(this.engineOptions, newOptions);
  }

  /**
   * Starts up the engine by intializing processes for all the agents and setting some variables for a match
   * @param agents - The agents involved to be setup for the given match
   * @param match - The match to initialize
   * @returns a promise that resolves true if succesfully initialized
   */
  async initialize(agents: Array<Agent>, match: Match): Promise<void> {
    
    this.log.systembar();

    let agentSetupPromises: Array<Promise<void>> = [];

    match.agents.forEach((agent: Agent, index: number) => {
      agentSetupPromises.push(this.initializeAgent(agent, match));
    }, this);

    await Promise.all(agentSetupPromises);
    this.log.system('FINISHED INITIALIZATION OF PROCESSES\n');
    return;
  }


  /**
   * Returns a promise that resolves once the process succesfully spawned and rejects if error occurs
   * @param pid - process id to check
   */
  private async spawnedPromise(pid: number) {
    const refreshRate = 10;
    const checkSpawn = () => {
      return new Promise((resolve, reject) => {
        exec(`ps -p ${pid}`, (err, stdout) => {
          if (err) reject(err);
          if (stdout.split('\n').length > 2) {
            resolve();
          }
          reject();
        });
      })
    }
    const setSpawnCheckTimer = (resolve, reject) => {
      setTimeout(() => {
        checkSpawn().then(() => {
          resolve();
        }).catch((err) => {
          if (err) reject(err);
          setSpawnCheckTimer(resolve, reject);
        })
      }, refreshRate);
    }
    return new Promise((resolve, reject) => {
      setSpawnCheckTimer(resolve, reject);
    });
  }

  /**
   * Initializes a single agent, called by {@link initialize}
   * @param agent - agent to initialize
   * @param match - match to initialize in
   */
  private async initializeAgent(agent: Agent, match: Match): Promise<void> {
    this.log.system("Setting up and spawning " + agent.name + ` | Command: ${agent.cmd} ${agent.src}`);

    // wait for install step
    await agent._install();
    this.log.system('Succesfully ran install step for agent ' + agent.id);

    // wait for compilation step
    await agent._compile();
    this.log.system('Succesfully ran compile step for agent ' + agent.id);

    // spawn the agent process
    let p = await agent._spawn();
    this.log.system('Spawned agent ' + agent.id);

    // add listener for memory limit exceeded
    p.on(MatchEngine.AGENT_EVENTS.EXCEED_MEMORY_LIMIT, (stat) => {
      this.engineOptions.memory.memoryCallback(agent, match, this.engineOptions);
    });

    // add listener for timeouts
    p.on(MatchEngine.AGENT_EVENTS.TIMEOUT, () => {
      this.engineOptions.timeout.timeoutCallback(agent, match, this.engineOptions);
    })

    match.idToAgentsMap.set(agent.id, agent);

    // set agent status as running
    agent.status = Agent.Status.RUNNING;

    // handler for stdout of Agent processes. Stores their output commands and resolves move promises
    p.stdout.on('readable', () => {

      let data: Array<string>;
      while (data = p.stdout.read()) {
        // split chunks into line by line and handle each line of commands
        let strs = `${data}`.split('\n');

        // first store data into a buffer and process later if no newline character is detected
        // if final char in the strs array is not '', then \n is not at the end
        if (this.engineOptions.commandLines.waitForNewline && strs.length >= 1 && strs[strs.length - 1] != '') {
          // using split with \n should make any existing final \n character to be set as '' in strs array
          
          // if there is an existing buffer from the previous 'readable' event, 
          // concat it to the first strs element as it belongs with that
          if (strs.length > 1) {
            // greater than 1 implies the first strs element is delimited by a \n
            strs[0] = agent._buffer.join('').concat(strs[0])
            agent._buffer = [];
          }
          for (let i = 0; i < strs.length - 1; i++) {
            if (strs[i] === '') continue;
            if (agent.isAllowedToSendCommands()) {
              this.handleCommmand(agent, strs[i]);
            }
          }
          // push whatever didn't have a newline into buffer
          agent._buffer.push(strs[strs.length - 1]);
        }
        else {
          if (strs.length > 1) {
            // greater than 1 implies the first strs element is delimited by a \n
            strs[0] = agent._buffer.join('').concat(strs[0]);
            agent._buffer = [];
          }
          // this.log.systemIO(`${agent.name} - stdout: ${strs}`);
          for (let i = 0; i < strs.length; i++) {
            if (strs[i] === '') continue;
            if (agent.isAllowedToSendCommands()) {
              this.handleCommmand(agent, strs[i]);
            }
          }
        }
        
      }
    });

    // log stderr from agents to this stderr if option active
    p.stderr.on('data', (data) => {
      this.log.error(`${agent.id}: ${data.slice(0, data.length - 1)}`);
    });

    // when process closes, print message
    p.on('close', (code) => {
      this.log.system(`${agent.name} | id: ${agent.id} - exited with code ${code}`);

      // remove the agent files if on secureMode and double check it is the temporary directory
      if (agent.options.secureMode) {
        let tmpdir = os.tmpdir();
        if (agent.cwd.slice(0, tmpdir.length) === tmpdir) {
          exec(`sudo rm -rf ${agent.cwd}`);
        }
        else {
          this.log.error('couldn\'t remove agent files while in secure mode');
        }
      }
      
    });

    // store process
    agent.process = p;

    if (this.engineOptions.memory.active) {
      const checkAgentMemoryUsage = () => {
        // setting { maxage: 0 } because otherwise pidusage leaves interval "memory leaks" and process doesn't exit fast
        pidusage(agent.process.pid, { maxage: 0 }).then((stat) => {
          if (stat.memory > this.engineOptions.memory.limit) {
            agent.process.emit(MatchEngine.AGENT_EVENTS.EXCEED_MEMORY_LIMIT, stat);
          }
        }).catch(() => {
          // ignore errors
        });
      }
      checkAgentMemoryUsage();
      agent.memoryWatchInterval = setInterval(() => {
        checkAgentMemoryUsage();
      }, this.engineOptions.memory.checkRate);
    }


    // this is for handling a race condition explained in the comments of this.killOffSignal
    // Briefly, sometimes agent process isn't stored yet during initialization and doesn't get killed as a result
    if (this.killOffSignal) {
      this.kill(agent);
    }
  }

  /**
   * Handles partial stdout from an agent
   * @param agent - the agent to process the command for
   * @param str - the string the agent sent
   */
  private async handleCommmand(agent: Agent, str: string) {

    // TODO: Implement parallel command stream type
    if (this.engineOptions.commandStreamType === MatchEngine.COMMAND_STREAM_TYPE.SEQUENTIAL) {
      // IF SEQUENTIAL, we wait for each unit to finish their move and output their commands
      
      switch (this.engineOptions.commandFinishPolicy) {
        
        case MatchEngine.COMMAND_FINISH_POLICIES.FINISH_SYMBOL:
          // if we receive the symbol representing that the agent is done with output and now awaits for updates
          if (`${str}` === this.engineOptions.commandFinishSymbol) { 
            agent.finishMove();
          }
          else {
            agent.currentMoveCommands.push(str);
          }
          break;
        case MatchEngine.COMMAND_FINISH_POLICIES.LINE_COUNT:
          
          // if we receive the finish symbol, we mark agent as done with output (finishes their move prematurely)
          if (`${str}` === this.engineOptions.commandFinishSymbol) { 
            agent.finishMove();
          }
          // only log command if max isnt reached
          else if (agent.currentMoveCommands.length < this.engineOptions.commandLines.max - 1) {
            agent.currentMoveCommands.push(str);
          }
          // else if on final command before reaching max, push final command and resolve
          else if (agent.currentMoveCommands.length == this.engineOptions.commandLines.max - 1) {
            agent.finishMove();
            agent.currentMoveCommands.push(str);
          }
          break;
        case MatchEngine.COMMAND_FINISH_POLICIES.CUSTOM:
          // TODO: Not implemented yet
          throw new NotSupportedError('Custom command finish policies are not allowed yet');
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
  public async stop(match: Match) {
    match.agents.forEach((agent) => {
      agent.process.kill('SIGSTOP')
      agent.status = Agent.Status.STOPPED;
    });
    this.log.system('Stopped all agents');
  }

  /**
   * Attempts to gracefully and synchronously resume a previously stopped match
   * @param match - the match to resume
   */
  public async resume(match: Match) {
    match.agents.forEach((agent) => {
      agent._allowCommands();
      agent.process.kill('SIGCONT')
      agent.status = Agent.Status.RUNNING;
    });
    this.log.system('Resumed all agents');
  }

  /**
   * Kills all agents and processes from a match and cleans up. Kills any game processes as well. Shouldn't be used
   * for custom design based matches. Called by {@link Match}
   * 
   * @param match - the match to kill all agents in and clean up
   */
  public async killAndClean(match: Match) {
    // set to true to ensure no more processes are being spawned.
    this.killOffSignal = true; 
    match.agents.forEach((agent) => {
      // kill the process if it is not null
      if (agent.process) {
        this.kill(agent);
      }
    });
  }

  /**
   * Kills an agent and closes the process, and no longer attempts to receive coommands from it anymore
   * @param agent - the agent to kill off
   */
  public async kill(agent: Agent) {
    agent._terminate();
    agent.currentMoveResolve();
    this.log.system(`Killed off agent ${agent.id} - ${agent.name}`);
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
      let commands: Array<MatchEngine.Command> = [];
      let nonTerminatedAgents = match.agents.filter((agent: Agent) => {
        return !agent.isTerminated();
      })
      let allAgentMovePromises = nonTerminatedAgents.map((agent: Agent) => {
        return agent.currentMovePromise;
      });
      Promise.all(allAgentMovePromises).then(() => {
        
        this.log.system(`All move promises resolved`);
        match.agents.forEach((agent: Agent) => {
          // TODO: Add option to store sets of commands delimited by '\n' for an Agent as different sets of commands /// for that Agent. Default right now is store every command delimited by the delimiter

          // for each set of commands delimited by '\n' in stdout of process, split it by delimiter and push to 
          // commands
          agent.currentMoveCommands.forEach((commandString) => {
            commandString.split(this.engineOptions.commandDelimiter).forEach((c) => {
              // we don't accept '' as commands.
              if (c !== '') {
                commands.push({command: c, agentID: agent.id})
              }
            });
          });
        });

        this.log.system2(`Agent commands at end of time step ${match.timeStep} to be sent to match on time step ${match.timeStep + 1} `);
        this.log.system2(commands.length ? JSON.stringify(commands) : 'No commands');
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
  public send(match: Match, message: string, agentID: Agent.ID): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let agent = match.idToAgentsMap.get(agentID);
      if (!agent.process.stdin.destroyed && !agent.isTerminated()) {
        agent.process.stdin.write(`${message}\n`, (error: Error) => {
          if (error) reject(error);
          resolve(true);
        });
      }
      else {
        this.log.error(`Agent ${agentID} - ${agent.name} - has been killed off already, can't send messages now`);
      }
    });
  }

  /**
   * TODO: Initialize a custom design based match and run through some basic security measures
   * @param match - The match to initialize with a custom design
   */
  async initializeCustom(match: Match): Promise<boolean> {
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
        reject(new FatalError('Override was not set active! Make sure to set the overide.active field to true'));
      }
      let cmd = this.overrideOptions.command;
  
      let parsed = this.parseCustomArguments(match, this.overrideOptions.arguments);
  
      // spawn the match process with the parsed arguments
      let matchProcessTimer: any;

      let fullcmd = [cmd, parsed.join(' ')];
      match.matchProcess = spawn(cmd, parsed).on('error', (err) => {
        if (err) throw err;
      });
      this.log.system(`${match.name} | id: ${match.id} - spawned: ${fullcmd}`);

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
        while (data = match.matchProcess.stdout.read()) {
          // split chunks into line by line and handle each line of output
          let strs = `${data}`.split('\n');
          for (let i = 0; i < strs.length; i++) {
            let str = strs[i];

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
        this.log.system(`${match.name} | id: ${match.id} - exited with code ${code}`);
        if (matchTimedOut) {
          reject(new MatchError('Match timed out'));
        }
        else {
          clearTimeout(matchProcessTimer);
          resolve(match.results);
          
        }
      });

    });
  }

  /**
   * Attempts to stop a {@link Match} based on a custom {@link Design}
   * @param match - the match to stop
   */
  public async stopCustom(match: Match) {
    // attempt to stop the match
    match.matchProcess.kill('SIGSTOP');
    // TODO: stop the match process timer
  };

  /**
   * Attempts to resume a {@link Match} based on a custom {@link Design}
   * @param match - the match to resume
   */
  public async resumeCustom(match: Match) {
    // attempt to resume the match
    match.matchProcess.kill('SIGCONT');
  };

  /**
   * Attempts to kill and clean up anything else for a custom design based match
   * @param match - the match to kill and clean up
   */
  public async killAndCleanCustom(match: Match) {
    if (match.matchProcess) match.matchProcess.kill('SIGKILL');
  }

  /**
   * Parses a list of arguments for a given match and populates relevant strings as needed
   * @param match - the match to parse arguments for
   * @param args - the arguments to parse
   */
  private parseCustomArguments(match: Match, args: Array<string | DDS>): Array<string> {

    if (match.matchStatus === Match.Status.UNINITIALIZED) {
      throw new FatalError(`Match ${match.id} - ${match.name} is not initialized yet`);
    }

    let parsed = [];
    
    for (let i = 0; i < args.length; i++) {
      switch(args[i]) {
        case DDS.D_FILES:
          match.agents.forEach((agent) => {
            parsed.push(agent.file);
          });
          break;
        case DDS.D_TOURNAMENT_IDS:
          match.agents.forEach((agent) => {
            // pass in tournament ID string if it exists, otherwise pass in 0
            parsed.push(agent.tournamentID.id ? agent.tournamentID : '0');
          });
          break;
        case DDS.D_AGENT_IDS:
          match.agents.forEach((agent) => {
            parsed.push(agent.id);
          });
          break;
        case DDS.D_MATCH_ID:
          parsed.push(match.id);
          break;
        case DDS.D_MATCH_NAME:
          parsed.push(match.name);
          break;
        case DDS.D_NAMES:
          match.agents.forEach((agent) => {
            let parsedName = agent.name;
            parsedName = parsedName.replace('/', '-');
            parsedName = parsedName.replace(' ', '_');
            parsed.push(parsedName);
          });
        default:
          parsed.push(args[i]);
          break;
      }
    }

    return parsed;
  }

}

export module MatchEngine {

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
    CUSTOM = 'custom'
    // TODO: implement custom finish policy
  }

  /**
   * Engine Options that specify how the MatchEngine should operate on a {@link Match}
   */
  export type EngineOptions = EngineOptionsAlias;

  /** Standard ways for commands from agents to be streamed to the MatchEngine for the {@link Design} to handle */
  export enum COMMAND_STREAM_TYPE {
    /** First come first serve for commands run. Not implemented */
    PARALLEL = 'parallel',
    /** Each agent's set of commands is run before the next agent */
    SEQUENTIAL = 'sequential'
  };
  /**
   * A command delimited by the delimiter of the match engine from all commands sent by agent specified by agentID
   */
  export interface Command {
    command: string
    agentID: Agent.ID
  }

  export enum AGENT_EVENTS {
    EXCEED_MEMORY_LIMIT = 'exceedMemoryLimit',
    TIMEOUT = 'timeout'
  }
}

export const BOT_USER = 'dimensions_bot';
export const ROOT_USER = 'root';
