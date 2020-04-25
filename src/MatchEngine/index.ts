import { FatalError, MatchError } from "../DimensionError";
import { DeepPartial } from "../utils/DeepPartial";
import { deepMerge } from "../utils/DeepMerge";
import { Design } from '../Design';
import { Design as DesignTypes } from '../Design/types';
import { Logger } from '../Logger';
import { Agent } from '../Agent';
import { Match } from '../Match';
import { deepCopy } from '../utils/DeepCopy';
import { spawn } from 'child_process';
import EngineOptions = MatchEngine.EngineOptions;
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
  async initialize(agents: Array<Agent>, match: Match): Promise<boolean> {
    
    this.log.systembar();

    return new Promise((resolve, reject) => {
      let agentSetupPromises: Array<Promise<boolean>> = [];

      match.agents.forEach( async (agent: Agent, index: number) => {
        agentSetupPromises.push(new Promise( async (res, rej) => {

          this.log.system("Setting up and spawning " + agent.name + ` | Command: ${agent.cmd} ${agent.src}`);
        
          // wait for compilation step
          await agent._compile();

          this.log.system('Succesfully ran compile step for agent ' + agent.id);

          // spawn the agent process
          let p = await agent._spawn();

          match.idToAgentsMap.set(agent.id, agent);

          // set agent status as running
          agent.status = Agent.Status.RUNNING;

          // handler for stdout of Agent processes. Stores their output commands and resolves move promises
          
          p.stdout.on('readable', () => {
            let data: string[];
            while (data = p.stdout.read()) {
              // split chunks into line by line and handle each line of commands
              let strs = `${data}`.split('\n');
              // first store data into a buffer and process later if no newline character is detected
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
                  if (agent.getAllowedToSendCommands()) {
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
                this.log.systemIO(`${agent.name} - stdout: ${strs}`);
                for (let i = 0; i < strs.length; i++) {
                  if (agent.getAllowedToSendCommands()) {
                    this.handleCommmand(agent, strs[i]);
                  }
                }
              }
              
            }
          });

          // log stderr from agents to this stderr
          p.stderr.on('data', (data) => {
            this.log.error(`${agent.id}: ${data.slice(0, data.length - 1)}`);
          });

          // when process closes, print message
          p.on('close', (code) => {
            this.log.system(`${agent.name} | id: ${agent.id} - exited with code ${code}`);
          });

          // store process
          agent.process = p;
          res();
        }))
      }, this);

      this.log.system('FINISHED INITIALIZATION OF PROCESSES\n');
      Promise.all(agentSetupPromises).then(() => {
        resolve();
      }).catch((error) => {
        reject(error);
      })
    })
  }

  /**
   * Handles partial stdout from an agent
   * @param agent - the agent to process the command for
   * @param str - the string the agent sent
   */
  private async handleCommmand(agent: Agent, str: string) {

    // TODO: Implement parallel command stream type
    // TODO: Implement timeout mechanism
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
          // only log command if max isnt reached
          if (agent.currentMoveCommands.length < this.engineOptions.commandLines.max - 1) {
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
          throw new FatalError('Custom command finish policies are not allowed yet');
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
   * Kills all agents and processes from a match and cleans up
   * @param match - the match to kill all agents in and clean up
   */
  public async killAndClean(match: Match) {
    match.agents.forEach((agent) => {
      agent.process.kill('SIGKILL')
      agent.status = Agent.Status.KILLED;
    });
  }

  /**
   * Kills an agent and closes the process, and no longer attempts to receive coommands from it anymore
   * @param agent - the agent to kill off
   */
  public async kill(agent: Agent) {
    agent.process.kill('SIGKILL');
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
  public async getCommands(match: Match): Promise<Array<MatchEngine.Command>> {
    return new Promise((resolve, reject) => {
      try {
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

      }
      catch(error) {
        reject(error);
      }
    });
  }

  /**
   * Sends a message to a particular process governed by an agent in a specified match specified by the agentID
   * @param match - the match to work with
   * @param message - the message to send to agent's stdin
   * @param agentID - id that specifies the agent in the match to send the message to
   */
  public async send(match: Match, message: string, agentID: Agent.ID): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let agent = match.idToAgentsMap.get(agentID);
      if (!agent.process.stdin.destroyed) {
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
  public async runCustom(match: Match): Promise<Array<string>> {
    return new Promise((resolve, reject) => {
      
      if (this.overrideOptions.active == false) {
        reject(new FatalError('Override was not set active! Make sure to set the overide.active field to true'));
      }
      let cmd = this.overrideOptions.command;
  
      let parsed = this.parseCustomArguments(match, this.overrideOptions.arguments);
  
      // spawn the match process with the parsed arguments
      let matchProcessTimer;

      let pathparts = cmd.split('/');
      let cwd = pathparts.slice(0, -1).join('/');
      let fullcmd = [cmd, parsed.join(' ')];
      let matchProcess = spawn(cmd, parsed).on('error', (err) => {
        if (err) throw err;
      });
      this.log.system(`${match.name} | id: ${match.id} - spawned: ${fullcmd}`);

      let matchTimedOut = false;
      // set up timer if specified
      if (this.overrideOptions.timeout !== null) {
        matchProcessTimer = setTimeout(() => {
          this.log.system(`${match.name} | id: ${match.id} - Timed out`);
          matchProcess.kill('SIGKILL');
          matchTimedOut = true;
        }, this.overrideOptions.timeout);
      }

  
      let processingStage = false;
      let results: Array<string> = [];
      matchProcess.stdout.on('readable', () => {
        let data: string[];
        while (data = matchProcess.stdout.read()) {
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
      
      matchProcess.stdout.on('close', (code) => {
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
     * Agent's finish their commands after they send {@link EngineOptions.commandLines.max} lines
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
  export interface EngineOptions {
    /** The command streaming type */
    commandStreamType: COMMAND_STREAM_TYPE,
    /** 
     * Delimiter for seperating commands from agents in their stdout and then sending these delimited commands to
     * {@link Design.update}. If an agent sent `move a b 3,run 24 d,t 3` and the delimiter is `','` then the 
     * {@link Design.update} function will receive commands `'move a b 3'` and `'run 24 d'` and `'t 3'`
     * @default ','
     */
    commandDelimiter: string, 
    /** 
     * The finish symbol to use 
     * @default 'D_FINISH'
     */
    commandFinishSymbol: string,
    /** 
     * Which kind of command finishing policy to use 
     * @default 'finish_symbol'
     */
    commandFinishPolicy: COMMAND_FINISH_POLICIES,
    /** 
     * Options for the {@link COMMAND_FINISH_POLICIES.LINE_COUNT} finishing policy. Used only if this policy is active
     */
    commandLines: {
      /** 
       * Maximum lines of commands delimited by new line characters '\n' allowed before engine cuts off an Agent 
       * @default 1
       */
      max: number,
      /** 
       * Whether the engine should wait for a newline character before processing the line of commands received 
       * This should for most cases be set to `true`; false will lead to some unpredictable behavior.
       * @default true
       */
      waitForNewline: boolean
    }

    /** 
     * Options for timeouts of agents 
     */
    timeout: {
      /** 
       * On or not 
       * @default true 
       */
      active: boolean,
      /** 
       * How long in milliseconds each agent is given before they are timed out and the timeoutCallback 
       * function is called
       * @default 1000
       */
      max: number,
      /** 
       * the callback called when an agent times out. 
       * Default is kill the agent with {@link Match.kill}.
       */
      timeoutCallback: 
      /** 
       * @param agent the agent that timed out
       * @param match - the match the agent timed out in
       * @param engineOptions - a copy of the engineOptions used that timed out the agent
       */
        (agent: Agent, match: Match, engineOptions: EngineOptions) => void
    }
  }

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
}