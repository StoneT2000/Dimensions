import { Design, Agent, DimensionError, agentID, Logger, LoggerLEVEL, Match, COMMAND_STREAM_TYPE, Command } from "..";
import { spawn } from 'child_process';

const log = new Logger();

// All IO commands that are used for communication between `MatchEngine` and processes associated with `Agents`
export enum IO_COMMANDS {
  MOVE_FNISH = 'D_FINISH', // indicate an Agent is done with their move at the current time step
  MOVE_START = 'D_START'
}

export type EngineOptions = {
  commandStreamType: COMMAND_STREAM_TYPE,
  commandDelimiter: string, // delimiter for seperating commands e.g move 01 02,buy 32_4_2,cmd 2 a b...
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

  public engineOptions: EngineOptions;

  private log = new Logger();
  
  constructor(design: Design, loggingLevel: LoggerLEVEL) {
    this.design = design;
    let { commandStreamType, commandDelimiter } = this.design.getDesignOptions();
    this.engineOptions = {
      commandStreamType: commandStreamType,
      commandDelimiter: commandDelimiter
    }
    this.log.identifier = `Engine`
    this.setLogLevel(loggingLevel);
  }

  setLogLevel(loggingLevel: LoggerLEVEL) {
    this.log.level = loggingLevel;
  }

  /**
   * Starts up the engine by intializing processes for all the agents and setting some variables for a match
   * @param agents 
   */
  async initialize(agents: Array<Agent>, match: Match) {
    
    this.log.systembar();

    match.agents.forEach((agent: Agent, index: number) => {
      // spawn a process
      this.log.system("Setting up and spawning " + agent.name + ` | Command: ${agent.cmd} ${agent.src}`);

      // TODO: make this async and use promise
      let p = spawn(agent.cmd, [agent.src]).on('error', function( err ){ throw err })

      match.idToAgentsMap.set(agent.id, agent);

      // handler for stdout of Agent processes. Stores their output commands and resolves move promises
      
      p.stdout.on('data', (data) => {
        
        // split chunks into line by line and handle each line of commands
        `${data}`.split('\n').forEach((str) => {
          this.log.system(`${agent.name} - stdout: ${str}`);

          // TODO: Implement parallel command stream type
          // TODO: Implement timeout mechanism
          
          if (this.engineOptions.commandStreamType === COMMAND_STREAM_TYPE.SEQUENTIAL) {
            // IF SEQUENTIAL, we wait for each unit to finish their move and output their commands
            if (`${str}` === IO_COMMANDS.MOVE_FNISH) {
              // Resolve move and tell engine in `getCommands` this agent is done outputting commands and awaits input
              agent.currentMoveResolve();
              // stop the process for now from sending more output
              agent.process.kill('SIGSTOP');
            }
            else {
              agent.currentMoveCommands.push(str);
            }
          }
          else if (this.engineOptions.commandStreamType === COMMAND_STREAM_TYPE.PARALLEL) {
            // If PARALLEL, theres no waiting, we store commands immediately and resolve right away after each command
            agent.currentMoveResolve();
            // updates to match are first come first serve
          }
          
        });
        
      });

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

    this.log.system('INITIALIZATION PROCESSES END\n');
    return true;
  }
  public async stop() {

  }

  // kills all agents and processes from a match and cleans up
  public async killAndClean(match: Match) {
    match.agents.forEach((agent) => {
      agent.process.kill('SIGTERM')
    });
  }
  


  /**
   * Returns a promise that resolves with all the commands loaded from the previous time step of the provided match
   * This coordinates all the Agents and waits for each one to finish their step
   */
  public async getCommands(match: Match): Promise<Array<Command>> {
    return new Promise((resolve, reject) => {
      try {
        let commands: Array<Command> = [];
        let allAgentMovePromises = match.agents.map((agent: Agent) => {
          return agent.currentMovePromise;
        });

        Promise.all(allAgentMovePromises).then(() => {
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

          this.log.system(`Agent commands at end of time step ${match.timeStep} to be sent to match on time step ${match.timeStep + 1} `);
          this.log.system(commands.length ? JSON.stringify(commands) : 'No commands');
          resolve(commands);
        });

      }
      catch(error) {
        reject(error);
      }
    });
  }

  // send a message in a match to a particular process governed by an Agent, resolves true if succesfully written
  public async send(match: Match, message: string, id: agentID) {
    return new Promise((resolve, reject) => {
      let agent = match.idToAgentsMap.get(id);
      agent.process.stdin.write(`${message}\n`, (error: Error) => {
        if (error) reject(error);
        resolve(true);
      });
    });
  }

}