import { Logger, LoggerLEVEL, FatalError } from "..";
import { ChildProcess } from "child_process";

import fs from 'fs';

export enum AgentStatus {
  UNINITIALIZED, // just created agent
  READY, // agent that has been fully created and ready to be used by the engine for a match
  RUNNING, // agent that has a process running with it now
  CRASHED,
  KILLED, // agent that has finished and is killed or was prematurely killed
  STOPPED // agent is currently not running
}
export type agentID = number;

/**
 * @class Agent
 * @classdesc Reads in a file source for the code and creates an `Agent` for use in the `MatchEngine` and `Match`
 * 
 */
export class Agent {
  
  public id: agentID = 0;
  public name: string; // name of this agent
  public src: string; // path to file to run
  public cmd: string; // command used to run file

  process: ChildProcess = null;

  // current status of the agent
  public status: AgentStatus = AgentStatus.UNINITIALIZED;

  public currentMoveCommands: Array<string> = [];

  public creationDate: Date;
  // a promise that resolves when the Agent's current move in the `Match` is finished
  public currentMovePromise: Promise<void>;
  public currentMoveResolve: Function = () => {}; // set as a dummy function
  public currentMoveReject: Function;

  public agentTimeStep = 0;

  private log = new Logger();

  // whether agent is allowed to send commands. Used to help ignore extra output from agents
  private allowedToSendCommands = true;
  private terminated = false;
  
  constructor(file: string, options: any) {
    this.creationDate = new Date();
    this.src = file;
    let ext = this.src.slice(-3);
    switch(ext) {
      case '.py':
        this.cmd = 'python'
        break;
      case '.js':
        this.cmd = 'node'
        break;
      case '.java':
        this.cmd = 'java'
      default:
        // throw new DimensionError(`${ext} is not a valid file type`);
    }

    // check if file exists
    if(!fs.existsSync(file)) {
      throw new FatalError(`${file} does not exist, check if file path provided is correct`);
    }

    if (options.command) {
      this.cmd = options.command;
    } else if (!this.cmd) {
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
    

    this.log.level = options.loggingLevel;

    this.log.system(`Created agent: ${this.name}`);

    // set agent as ready
    this.status = AgentStatus.READY;

  }
  isTerminated() {
    return this.status === AgentStatus.KILLED;
  }
  _terminate() {
    this.status = AgentStatus.KILLED;
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
  // Start an Agent's move and setup the promise structures
  _setupMove() {
    // continue agent again
    this.process.kill('SIGCONT');
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
  static generateAgents(files: Array<String> | Array<{file: string, name: string}>, loggingLevel: LoggerLEVEL): Array<Agent> {
    if (files.length === 0) {
      throw new FatalError('No files provided to generate agents with!');
    }
    let agents: Array<Agent> = [];

    if (typeof files[0] === 'string') {
      files.forEach((file, index) => {
        agents.push(new Agent(file, {id: index, name: null, loggingLevel: loggingLevel}))
      })
    }
    else {
      files.forEach((info, index) => {
        agents.push(new Agent(info.file, {id: index, name: info.name, loggingLevel: loggingLevel}))
      })
    }
    return agents;
  }
}