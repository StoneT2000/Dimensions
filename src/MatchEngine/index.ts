import { Design, Agent, DimensionError, agentID, Logger, LoggerLEVEL, Match, COMMAND_STREAM_TYPE, Command } from "..";
import { spawn } from 'child_process';
import { AgentStatus } from "../";
import { MatchStatus } from "../Match";
import { FatalError } from "../DimensionError";

// All IO commands that are used for communication between `MatchEngine` and processes associated with `Agents`
export enum IO_COMMANDS {
  MOVE_FNISH = 'D_FINISH', // indicate an Agent is done with their move at the current time step
  MOVE_START = 'D_START'
}

export enum COMMAND_FINISH_POLICIES {
  FINISH_SYMBOL = 'finish_symbol', // stops an agents command stream after they send the commandFinishSymbol
  LINE_COUNT = 'line_count', // stops an agents command stream after they send some number lines
  CUSTOM = 'custom' // stops agents command stream based on a custom function that returns true if agent is done or not 
  // TODO: implement custom finish policy
}

export type EngineOptions = {
  commandStreamType: COMMAND_STREAM_TYPE,
  commandDelimiter: string, // delimiter for seperating commands e.g move 01 02,buy 32_4_2,cmd 2 a b...
  commandFinishSymbol: string,
  commandFinishPolicy: COMMAND_FINISH_POLICIES,
  commandLines: {
    max: number, // max lines commands allowed
    // min: number // min lines of commands required, TODO: not really used at the moment
  }
}
/**
 * @class MatchEngine
 * @classdesc The Match Engine that takes a `Design` and starts matches by spawning new processes for each `Agent`
 * It returns results while a game is running and returns final results as well. Can start and stop the engine
 * Functionally runs matches as storing the match causes circular problems 
 * (previously Match has Engine, Engine has Match)
 */
export class MatchEngine {

  // The design the MatchEngine runs on
  private design: Design;

  private engineOptions: EngineOptions;

  private log = new Logger();
  
  constructor(design: Design, loggingLevel: LoggerLEVEL) {
    this.design = design;
    this.engineOptions = this.design.getDesignOptions().engineOptions;
    this.log.identifier = `Engine`;
    this.setLogLevel(loggingLevel);
  }

  setLogLevel(loggingLevel: LoggerLEVEL) {
    this.log.level = loggingLevel;
  }
  getEngineOptions() {
    return this.engineOptions;
  }
  setEngineOptions(newOptions: Partial<EngineOptions>) {
    Object.assign(this.engineOptions, newOptions);
  }

  /**
   * Starts up the engine by intializing processes for all the agents and setting some variables for a match
   * @param agents - The agents involved to be setup for the given match
   * @param match - The match to initialize
   * @returns a promise that resolves true if succesfully initialized
   */
  async initialize(agents: Array<Agent>, match: Match): Promise<boolean> {
    
    this.log.systembar();

    match.agents.forEach((agent: Agent, index: number) => {
      // spawn a process
      this.log.system("Setting up and spawning " + agent.name + ` | Command: ${agent.cmd} ${agent.src}`);

      // TODO: make this async and use promise
      let p = spawn(agent.cmd, [agent.src]).on('error', function( err ){ throw err })

      match.idToAgentsMap.set(agent.id, agent);

      // set agent status as running
      agent.status = AgentStatus.RUNNING;

      // handler for stdout of Agent processes. Stores their output commands and resolves move promises
      
      p.stdout.on('readable', () => {
        let data;
        while (data = p.stdout.read()) {
          // split chunks into line by line and handle each line of commands
          this.log.systemIO(`${agent.name} - stdout: ${data}`);
          let strs = `${data}`.split('\n');
          for (let i = 0; i < strs.length; i++) {
            if (agent.isAllowedToSendCommands()) {
              this.handleCommmand(agent, strs[i]);
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

    }, this);

    this.log.system('FINISHED INITIALIZATION OF PROCESSES\n');
    return true;
  }

  public async handleCommmand(agent: Agent, str: string) {

    // TODO: Implement parallel command stream type
    // TODO: Implement timeout mechanism
    if (this.engineOptions.commandStreamType === COMMAND_STREAM_TYPE.SEQUENTIAL) {
      // IF SEQUENTIAL, we wait for each unit to finish their move and output their commands
      
      switch (this.engineOptions.commandFinishPolicy) {
        
        case COMMAND_FINISH_POLICIES.FINISH_SYMBOL:
          // if we receive the symbol representing that the agent is done with output and now awaits for updates
          if (`${str}` === this.engineOptions.commandFinishSymbol) {
            // Resolve move and tell engine in `getCommands` this agent is done outputting commands and awaits input
            agent.currentMoveResolve();
            
            // stop the process for now from sending more output and disallow commmands to ignore rest of output
            agent.process.kill('SIGSTOP');
            agent._disallowCommands();
          }
          else {
            agent.currentMoveCommands.push(str);
          }
          break;
        case COMMAND_FINISH_POLICIES.LINE_COUNT:
          // only log command if max isnt reached
          if (agent.currentMoveCommands.length < this.engineOptions.commandLines.max - 1) {
            agent.currentMoveCommands.push(str);
          }
          // else if on final command before reaching max, push final command and resolve
          else if (agent.currentMoveCommands.length == this.engineOptions.commandLines.max - 1) {
            agent.currentMoveCommands.push(str);
            agent.currentMoveResolve();
            agent.process.kill('SIGSTOP');
            agent._disallowCommands();
          }
          break;
        case COMMAND_FINISH_POLICIES.CUSTOM:
          // TODO: Not implemented yet
          throw new FatalError('Custom command finish policies are not allowed yet');
          break;
      }

    }
    else if (this.engineOptions.commandStreamType === COMMAND_STREAM_TYPE.PARALLEL) {
      // If PARALLEL, theres no waiting, we store commands immediately and resolve right away after each command
      agent.currentMoveResolve();
      // updates to match are first come first serve
    }
  }

  /**
   * Attempts to gracefully and synchronously stop a match's agents
   * @param match - the match to stop
   */
  public async stop(match: Match) {
    match.agents.forEach((agent) => {
      agent.process.kill('SIGSTOP')
      agent.status = AgentStatus.STOPPED;
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
      agent.status = AgentStatus.RUNNING;
    });
    this.log.system('Resumed all agents');
  }

  /**
   * Kills all agents and processes from a match and cleans up
   */
  public async killAndClean(match: Match) {
    match.agents.forEach((agent) => {
      agent.process.kill('SIGKILL')
      agent.status = AgentStatus.KILLED;
    });
  }

  public async kill(agent: Agent) {
    agent.process.kill('SIGKILL');
  }
  
  /**
   * Returns a promise that resolves with all the commands loaded from the previous time step of the provided match
   * This coordinates all the Agents and waits for each one to finish their step
   * @param match - The match to get commands from agents for
   * @returns a promise that resolves with an array of `Command` elements, holding the command and id of the agent that 
   *          sent it
   */
  public async getCommands(match: Match): Promise<Array<Command>> {
    return new Promise((resolve, reject) => {
      try {
        this.log.system(`Retrieving commands`);
        let commands: Array<Command> = [];
        let allAgentMovePromises = match.agents.map((agent: Agent) => {
          return agent.currentMovePromise;
        });
        this.log.system(`Retrieved all move promises`)
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

          // once we collected all the commands, we now reset each Agent for the next move
          match.agents.forEach((agent: Agent) => {
            agent._setupMove();
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

  // send a message in a match to a particular process governed by an Agent, resolves true if succesfully written
  /**
   * Sends a message to a particular process governed by an agent in a specified match specified by the agentID
   * @param match - the match to work with
   * @param message - the message to send to agent's stdin
   * @param agentID - id that specifies the agent in the match to send the message to
   */
  public async send(match: Match, message: string, agentID: agentID): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let agent = match.idToAgentsMap.get(agentID);
      // TODO; add check to see if agent exists
      agent.process.stdin.write(`${message}\n`, (error: Error) => {
        if (error) reject(error);
        resolve(true);
      });
    });
  }

}