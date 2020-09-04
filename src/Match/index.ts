import { DeepPartial } from '../utils/DeepPartial';
import { deepMerge } from '../utils/DeepMerge';
import { MatchEngine } from '../MatchEngine';
import { Agent } from '../Agent';
import { Logger } from '../Logger';
import { Design } from '../Design';
import {
  FatalError,
  MatchDestroyedError,
  MatchWarn,
  MatchError,
  NotSupportedError,
  MatchReplayFileError,
} from '../DimensionError';
import { Tournament } from '../Tournament';

import EngineOptions = MatchEngine.EngineOptions;
import COMMAND_STREAM_TYPE = MatchEngine.COMMAND_STREAM_TYPE;
import Command = MatchEngine.Command;
import { ChildProcess } from 'child_process';
import { NanoID, Dimension } from '../Dimension';
import { genID } from '../utils';
import { deepCopy } from '../utils/DeepCopy';
import path from 'path';
import extract = require('extract-zip');
import { removeDirectory, removeFile } from '../utils/System';
import { BOT_DIR } from '../Station';
import { mkdirSync, existsSync, statSync } from 'fs';

/**
 * An match created using a {@link Design} and a list of Agents. The match can be stopped and resumed with
 * {@link stop}, {@link resume}, and state and configurations can be retrieved at any point in time with the
 * {@link state} and {@link configs} fields
 *
 * @see {@link Design} for Design information
 * @see {@link Agent} for Agent information
 */

export class Match {
  /**
   * When the match was created (called with new)
   */
  public creationDate: Date;

  /**
   * When the match finished
   */
  public finishDate: Date;

  /**
   * Name of the match
   */
  public name: string;

  /**
   * Match ID. It's always a 12 character NanoID
   */
  public id: NanoID;

  /**
   * The state field. This can be used to store anything by the user when this `match` is passed to the {@link Design}
   * life cycle functions {@link Design.initialize}, {@link Design.update}, and {@link Design.getResults}
   *
   * This is also used by the {@link CustomDesign} class to store all standard outputted match output for
   * matches running using a custom design and passing in {@link Design.OverrideOptions}.
   */
  public state: any;

  /**
   * List of the agents currently involved in the match.
   * @See {@link Agent} for details on the agents.
   */
  public agents: Array<Agent> = [];

  /**
   * Map from an {@link Agent.ID} ID to the {@link Agent}
   */
  public idToAgentsMap: Map<Agent.ID, Agent> = new Map();

  /**
   * The current time step of the Match. This time step is independent of any {@link Design} and agents are coordianted
   * against this timeStep
   */
  public timeStep = 0;

  /**
   * The associated {@link MatchEngine} that is running this match and serves as the backend for this match.
   */
  public matchEngine: MatchEngine;

  /**
   * The match logger.
   * @see {@link Logger} for details on how to use this
   */
  public log = new Logger();

  /**
   * The results field meant to store any results retrieved with {@link Design.getResults}
   */
  public results: any;

  /**
   * The current match status
   */
  public matchStatus: Match.Status = Match.Status.UNINITIALIZED;

  /**
   * A mapping from {@link Agent} IDs to the tournament id of the {@link Player} in a tournament that generated the
   * {@link Agent}
   */
  public mapAgentIDtoTournamentID: Map<Agent.ID, Tournament.ID> = new Map();

  /**
   * Match Configurations. See {@link Match.Configs} for configuration options
   */
  public configs: Match.Configs = {
    name: '',
    loggingLevel: Logger.LEVEL.INFO,
    engineOptions: {},
    secureMode: false,
    agentOptions: deepCopy(Agent.OptionDefaults),
    languageSpecificAgentOptions: {},
    storeReplay: true,
    storeReplayDirectory: 'replays',
    storeErrorLogs: true,
    storeErrorDirectory: 'errorlogs',
    agentSpecificOptions: [],
  };

  /** Match process used to store the process governing a match running on a custom design */
  matchProcess: ChildProcess;

  /** The timer set for the match process */
  matchProcessTimer: any;

  /** Signal to stop at next time step */
  private shouldStop = false;

  /** Promise for resuming */
  private resumePromise: Promise<void>;

  /** Resolver for the above promise */
  private resumeResolve: Function;

  /** Resolver for stop Promise */
  private resolveStopPromise: Function;

  /** Rejecter for the run promise */
  private runReject: Function;

  /**
   * Path to the replay file for this match
   */
  public replayFile: string;

  /**
   * Key used to retrieve the replay file from a storage plugin
   */
  public replayFileKey: string;

  /**
   * Non local files that should be removed as they are stored somewhere else. Typically bot files are non local if
   * using a backing storage service
   */
  private nonLocalFiles: Array<string> = [];

  /**
   * Match Constructor
   * @param design - The {@link Design} used
   * @param agents - List of agents used to create Match.
   * @param configs - Configurations that are passed to every run through {@link Design.initialize}, {@link Design.update}, and {@link Design.getResults} functioon in the
   * given {@link Design}
   */
  constructor(
    public design: Design,
    /**
     * agent meta data regarding files, ids, etc.
     */
    public agentFiles: /** array of file paths to agents */
    Agent.GenerationMetaData,
    configs: DeepPartial<Match.Configs> = {},
    private dimension: Dimension
  ) {
    // override configs with provided configs argument
    this.configs = deepMerge(deepCopy(this.configs), deepCopy(configs));

    // agent runs in securemode if parent match is in securemode
    this.configs.agentOptions.secureMode = this.configs.secureMode;
    // agent logging level is inherited from parent match.
    this.configs.agentOptions.loggingLevel = this.configs.loggingLevel;

    this.id = Match.genMatchID();

    this.creationDate = new Date();
    if (this.configs.name) {
      this.name = this.configs.name;
    } else {
      this.name = `match_${this.id}`;
    }

    // set logging level to what was given
    this.log.level = this.configs.loggingLevel;
    this.log.identifier = this.name;

    // store reference to the matchEngine used and override any options
    this.matchEngine = new MatchEngine(this.design, this.log.level);
    this.matchEngine.setEngineOptions(configs.engineOptions);
  }

  /**
   * Initializes this match using its configurations and using the {@link Design.initialize} function. This can
   * throw error with agent generation, design initialization, or with engine initialization. In engine initialization,
   * errors that can be thrown can be {@link AgentCompileError | AgentCompileErrors},
   * {@link AgentInstallError | AgentInstallErrors}, etc.
   *
   *
   * @returns a promise that resolves true if initialized correctly
   */
  public async initialize(): Promise<boolean> {
    try {
      this.log.infobar();
      this.log.info(
        `Design: ${this.design.name} | Initializing match - ID: ${this.id}, Name: ${this.name}`
      );
      const overrideOptions = this.design.getDesignOptions().override;

      this.log.detail('Match Configs', this.configs);

      this.timeStep = 0;

      if (this.configs.storeErrorLogs) {
        // create error log folder if it does not exist
        if (!existsSync(this.configs.storeErrorDirectory)) {
          mkdirSync(this.configs.storeErrorDirectory);
        }
        const matchErrorLogDirectory = this.getMatchErrorLogDirectory();
        if (!existsSync(matchErrorLogDirectory)) {
          mkdirSync(matchErrorLogDirectory);
        }
      }

      // this allows engine to be reused after it ran once
      this.matchEngine.killOffSignal = false;

      // copy over any agent bot files if dimension has a backing storage service and the agent has botkey specified
      // copy them over the agent's specified file location to use
      const retrieveBotFilePromises: Array<Promise<any>> = [];
      const retrieveBotFileIndexes: Array<number> = [];
      if (this.dimension.hasStorage()) {
        this.agentFiles.forEach((agentFile, index) => {
          if (agentFile.botkey && agentFile.file) {
            let useCachedBotFile = false;
            if (
              this.configs.agentSpecificOptions[index] &&
              this.configs.agentSpecificOptions[index].useCachedBotFile
            ) {
              useCachedBotFile = true;
            }
            retrieveBotFilePromises.push(
              this.retrieveBot(
                agentFile.botkey,
                agentFile.file,
                useCachedBotFile
              )
            );
            retrieveBotFileIndexes.push(index);
          }
        });
      }
      const retrievedBotFiles = await Promise.all(retrieveBotFilePromises);
      retrieveBotFileIndexes.forEach((val, index) => {
        if (!(typeof this.agentFiles[val] === 'string')) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          this.agentFiles[val].file = retrievedBotFiles[index];
          // push them as non local files so they can be removed when match is done
          this.nonLocalFiles.push(path.dirname(retrievedBotFiles[index]));
        }
      });

      // Initialize agents with agent files
      this.agents = Agent.generateAgents(
        this.agentFiles,
        this.configs.agentOptions,
        this.configs.languageSpecificAgentOptions
      );
      this.agents.forEach((agent) => {
        this.idToAgentsMap.set(agent.id, agent);
        if (agent.tournamentID !== null) {
          this.mapAgentIDtoTournamentID.set(agent.id, agent.tournamentID);
        }
      });

      // if overriding with custom design, log some other info and use a different engine initialization function
      if (overrideOptions.active) {
        this.log.detail('Match Arguments', overrideOptions.arguments);
        await this.matchEngine.initializeCustom();
      } else {
        // Initialize the matchEngine and get it ready to run and process I/O for agents
        await this.matchEngine.initialize(this.agents, this);
      }

      // by now all agents should up and running, all compiled and ready
      // Initialize match according to `design` by delegating intialization task to the enforced `design`
      await this.design.initialize(this);

      // remove initialized status and set as READY
      this.matchStatus = Match.Status.READY;
      return true;
    } catch (err) {
      // first handle log files in case they might hold relevant install / compile time logs
      this.handleLogFiles();
      // kill processes and clean up and then throw the error
      await this.killAndCleanUp();
      throw err;
    }
  }

  /**
   * Retrieves a bot through its key and downloads it to a random generated folder. Returns the new file's path
   * @param botkey
   * @param file
   * @param useCached - if true, storage plugin will avoid redownloading data. If false, storage plugin will always
   * redownload data
   */
  private async retrieveBot(botkey: string, file: string, useCached: boolean) {
    const dir = BOT_DIR + '/anon-' + genID(18);
    mkdirSync(dir);

    const zipFile = path.join(dir, 'bot.zip');
    // if useCached is true, actualZipFileLocation will likely be different than zipFile, and we directly re-extract
    // the bot from that zip file. It can be argued that it would be better to cache the unzipped bot instead but this
    // could potentially be a security concern by repeatedly copying over unzipped bot files instead of the submitted
    // zip file; and zip is smaller to cache
    const actualZipFileLocation = await this.dimension.storagePlugin.download(
      botkey,
      zipFile,
      useCached
    );

    await extract(actualZipFileLocation, {
      dir: dir,
    });
    return path.join(dir, path.basename(file));
  }

  /**
   * Runs this match to completion. Sets this.results to match results and resolves with the match results when done
   */
  public run(): Promise<any> {
    // returning new promise explicitly here because we need to store reject
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      try {
        this.runReject = reject;
        let status: Match.Status;

        this.matchStatus = Match.Status.RUNNING;

        // check if our design is a javascript/typescript based design or custom and to be executed with a
        // provided command
        const overrideOptions = this.design.getDesignOptions().override;
        if (overrideOptions.active) {
          this.log.system('Running custom');
          await this.matchEngine.runCustom(this);
          this.results = await this.getResults();

          // process results with result handler if necessary
          if (overrideOptions.resultHandler) {
            this.results = overrideOptions.resultHandler(this.results);
          }
        } else {
          // otherwise run the match using the design with calls to this.next()
          do {
            status = await this.next();
          } while (status != Match.Status.FINISHED);
          this.agents.forEach((agent: Agent) => {
            agent._clearTimer();
          });
          this.results = await this.getResults();
        }
        // kill processes and clean up
        await this.killAndCleanUp();

        // upload replayfile if given and using storage plugin
        if (this.results.replayFile) {
          // verify file exists and its a file
          if (existsSync(this.results.replayFile)) {
            if (!statSync(this.results.replayFile).isDirectory()) {
              if (this.configs.storeReplay) {
                this.replayFile = this.results.replayFile;
                if (this.dimension.hasStorage()) {
                  const fileName = path.basename(this.results.replayFile);

                  // store to storage and get key
                  const key = await this.dimension.storagePlugin.upload(
                    this.results.replayFile,
                    `${path.join(this.configs.storeReplayDirectory, fileName)}`
                  );
                  this.replayFileKey = key;
                  // once uploaded and meta data stored, remove old file
                  removeFile(this.replayFile);
                }
              } else {
                removeFile(this.results.replayFile);
              }
            } else {
              reject(
                new MatchReplayFileError(
                  `Replay file provided ${this.results.replayFile} is not a file`
                )
              );
            }
          } else {
            reject(
              new MatchReplayFileError(
                `Replay file provided ${this.results.replayFile} does not exist`
              )
            );
          }
        }
        // TODO: possible race condition if we dont wait for log files to upload
        this.handleLogFiles();
        this.finishDate = new Date();
        resolve(this.results);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handles log files and stores / uploads / deletes them as necessary
   */
  private async handleLogFiles() {
    const uploadLogPromises: Array<Promise<{
      key: string;
      agentID: number;
    }>> = [];
    const fileLogsToRemove: Array<string> = [];

    // upload error logs if stored
    if (this.configs.storeErrorLogs) {
      // upload each agent error log
      for (const agent of this.agents) {
        const filepath = path.join(
          this.getMatchErrorLogDirectory(),
          agent.getAgentErrorLogFilename()
        );
        if (existsSync(filepath)) {
          if (this.dimension.hasStorage()) {
            const uploadKeyPromise = this.dimension.storagePlugin
              .upload(filepath, filepath)
              .then((key) => {
                return { key: key, agentID: agent.id };
              });
            uploadLogPromises.push(uploadKeyPromise);
            fileLogsToRemove.push(filepath);
          }
        } else {
          // this shouldn't happen
          this.log.error(
            `Agent ${this.id} log file at ${filepath} does not exist`
          );
        }
      }
    }
    const logkeys = await Promise.all(uploadLogPromises);
    logkeys.forEach((val) => {
      this.idToAgentsMap.get(val.agentID).logkey = val.key;
    });

    if (fileLogsToRemove.length > 0) {
      removeDirectory(this.getMatchErrorLogDirectory());
    }
  }

  /**
   * Next function. Moves match forward by one timestep. Resolves with the match status
   * This function should always used to advance forward a match unless a custom design is provided
   *
   * Should not be called by user
   */
  public async next(): Promise<Match.Status> {
    const engineOptions = this.matchEngine.getEngineOptions();
    if (engineOptions.commandStreamType === COMMAND_STREAM_TYPE.SEQUENTIAL) {
      // if this.shouldStop is set to true, await for the resume promise to resolve
      if (this.shouldStop == true) {
        // set status and stop the engine
        this.matchStatus = Match.Status.STOPPED;
        this.matchEngine.stop(this);
        this.log.info('Stopped match');
        this.resolveStopPromise();
        await this.resumePromise;
        this.matchEngine.resume(this);
        this.log.info('Resumed match');
        this.shouldStop = false;
      }
      // at the start of each time step, we send any updates based on what agents sent us on the previous timestep
      // Updates sent by agents on previous timestep can be obtained with MatchEngine.getCommands
      // This is also the COORDINATION step, where we essentially wait for all commands from all agents to be
      // delivered out
      const commands: Array<Command> = await this.matchEngine.getCommands(this);
      this.log.system(`Retrieved ${commands.length} commands`);
      // Updates the match state and sends appropriate signals to all Agents based on the stored `Design`
      const status: Match.Status = await this.design.update(this, commands);

      // default status is running if no status returned
      if (!status) {
        this.matchStatus = Match.Status.RUNNING;
      } else {
        this.matchStatus = status;
      }

      // after we run update have send all the messages that need to be sent,
      // we now reset each Agent for the next move
      this.agents.forEach((agent: Agent) => {
        // continue agents again
        agent.resume();
        // setup the agent and its promises and get it ready for the next move
        agent._setupMove();

        // if timeout is set active
        if (engineOptions.timeout.active) {
          agent._setTimeout(() => {
            // if agent times out, emit the timeout event
            agent.timeout();
          }, engineOptions.timeout.max + MatchEngine.timeoutBuffer);
        }
        // each of these steps can take ~2 ms
      });

      // update timestep now
      this.timeStep += 1;

      return status;
    }

    // TODO: implement this
    else if (engineOptions.commandStreamType === COMMAND_STREAM_TYPE.PARALLEL) {
      // with a parallel structure, the `Design` updates the match after each command sequence, delimited by \n
      // this means agents end up sending commands using out of sync state information, so the `Design` would need to
      // adhere to this. Possibilities include stateless designs, or heavily localized designs where out of
      // sync states wouldn't matter much
      throw new NotSupportedError(
        'PARALLEL command streaming has not been implemented yet'
      );
    }
  }

  /**
   * Stops the match. For non-custom designs, stops at the next nearest timestep possible. Otherwise attempts to stop
   * the match using the {@link MatchEngine} stopCustom function.
   *
   * Notes:
   * - If design uses a PARALLEL match engine, stopping behavior can be a little unpredictable
   * - If design uses a SEQUENTIAL match engine, a stop will result in ensuring all agents complete all their actions up
   *   to a coordinated stopping `timeStep`
   */
  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.matchStatus != Match.Status.RUNNING) {
        this.log.warn("You can't stop a match that is not running");
        reject(new MatchWarn('You can\t stop a match that is not running'));
        return;
      }
      // if override is on, we stop using the matchEngine stop function
      if (this.design.getDesignOptions().override.active) {
        this.matchEngine
          .stopCustom(this)
          .then(() => {
            this.matchStatus = Match.Status.STOPPED;
            resolve();
          })
          .catch(reject);
        return;
      } else {
        this.resolveStopPromise = resolve;
        this.log.info('Stopping match...');
        this.resumePromise = new Promise((resolve) => {
          this.resumeResolve = resolve;
        });
        this.shouldStop = true;
      }
    });
  }

  /**
   * Resume the match if it was in the stopped state
   * @returns true if succesfully resumed
   */
  public resume(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.matchStatus != Match.Status.STOPPED) {
        this.log.warn("You can't resume a match that is not stopped");
        reject(new MatchWarn("You can't resume a match that is not stopped"));
        return;
      }
      this.log.info('Resuming match...');

      // if override is on, we resume using the matchEngine resume function
      if (this.design.getDesignOptions().override.active) {
        this.matchEngine
          .resumeCustom(this)
          .then(() => {
            this.matchStatus = Match.Status.RUNNING;
            resolve();
          })
          .catch(reject);
      } else {
        // set back to running and resolve
        this.matchStatus = Match.Status.RUNNING;
        this.resumeResolve();
        resolve();
      }
    });
  }

  /**
   * Stop all agents through the match engine and clean up any other files and processes
   *
   * Used by custom and dimensions based designs
   */
  private async killAndCleanUp() {
    await this.matchEngine.killAndClean(this);
    const removeNonLocalFilesPromises: Array<Promise<any>> = [];
    this.nonLocalFiles.forEach((nonLocalFile) => {
      removeNonLocalFilesPromises.push(removeDirectory(nonLocalFile));
    });
    await Promise.all(removeNonLocalFilesPromises);
  }

  /**
   * Terminate an {@link Agent}, kill the process. Note, the agent is still stored in the Match, but you can't send or
   * receive messages from it anymore
   *
   * @param agent - id of agent or the Agent object to kill
   * @param reason - an optional reason string to provide for logging purposes
   */
  public async kill(agent: Agent.ID | Agent, reason?: string): Promise<void> {
    if (agent instanceof Agent) {
      this.matchEngine.kill(agent, reason);
    } else {
      this.matchEngine.kill(this.idToAgentsMap.get(agent), reason);
    }
  }

  /**
   * Retrieve results through delegating the task to {@link Design.getResults}
   */
  public async getResults(): Promise<any> {
    // Retrieve match results according to `design` by delegating storeResult task to the enforced `design`
    return await this.design.getResults(this);
  }

  /**
   * Sends a message to the standard input of all agents in this match
   * @param message - the message to send to all agents available
   * @returns a promise resolving true/false if it was succesfully sent
   */
  public sendAll(message: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const sendPromises = [];
      this.agents.forEach((agent: Agent) => {
        sendPromises.push(this.send(message, agent));
      });

      Promise.all(sendPromises)
        .then(() => {
          // if all promises resolve, we sent all messages
          resolve(true);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  /**
   * Functional method for sending a message string to a particular {@link Agent}. Returns a promise that resolves true
   * if succesfully sent
   * @param message - the string message to send
   * @param receiver - receiver of message can be specified by the {@link Agent} or it's {@link Agent.ID} (a number)
   */
  public async send(
    message: string,
    receiver: Agent | Agent.ID
  ): Promise<void> {
    if (receiver instanceof Agent) {
      try {
        await this.matchEngine.send(this, message, receiver.id);
      } catch (err) {
        this.log.error(err);
        this.kill(receiver, 'could not send message anymore');
      }
    } else {
      try {
        await this.matchEngine.send(this, message, receiver);
      } catch (err) {
        this.log.error(err);
        this.kill(receiver, 'could not send message anymore');
      }
    }
  }

  /**
   * Throw an {@link FatalError}, {@link MatchError}, or {@link MatchWarn} within the Match. Indicates that the
   * {@link Agent} with id agentID caused this error/warning.
   *
   * Throwing MatchWarn will just log a warning level message and throwing a MatchError will just log it as an error
   * level message.
   *
   * Throwing FatalError will cause the match to automatically be destroyed. This is highly not recommended and it is
   * suggested to have some internal logic to handle moments when the match cannot continue.
   *
   *
   * Examples are misuse of an existing command or using incorrect commands or sending too many commands
   * @param agentID - the misbehaving agent's ID
   * @param error - The error
   */
  public async throw(agentID: Agent.ID, error: Error): Promise<void> {
    // Fatal errors are logged and should end the whole match
    if (error instanceof FatalError) {
      await this.destroy();
      this.log.error(
        `FatalError: ${this.idToAgentsMap.get(agentID).name} | ${error.message}`
      );
    } else if (error instanceof MatchWarn) {
      this.log.warn(
        `ID: ${agentID}, ${this.idToAgentsMap.get(agentID).name} | ${
          error.message
        }`
      );
    } else if (error instanceof MatchError) {
      this.log.error(
        `ID: ${agentID}, ${this.idToAgentsMap.get(agentID).name} | ${
          error.message
        }`
      );
      // TODO, if match is set to store an error log, this should be logged!
    } else {
      this.log.error(
        'User tried throwing an error of type other than FatalError, MatchWarn, or MatchError'
      );
    }
  }

  /**
   * Destroys this match and makes sure to remove any leftover processes
   */
  public async destroy(): Promise<void> {
    // reject the run promise first if it exists
    if (this.runReject)
      this.runReject(new MatchDestroyedError('Match was destroyed'));

    // now actually stop and clean up
    await this.killAndCleanUp(); // Theoretically this line is not needed for custom matches, but in here in case
    await this.matchEngine.killAndCleanCustom(this);
  }

  /**
   * Generates a 12 character nanoID string for identifying matches
   */
  public static genMatchID(): string {
    return genID(12);
  }

  public getMatchErrorLogDirectory(): string {
    return path.join(this.configs.storeErrorDirectory, `match_${this.id}`);
  }
}

export namespace Match {
  /**
   * Match Configurations. Has 5 specified fields. All other fields are up to user discretion
   */
  export interface Configs {
    /**
     * Name of the match
     */
    name: string;

    /**
     * Logging level for this match.
     * @see {@link Logger}
     */
    loggingLevel: Logger.LEVEL;

    /**
     * The engine options to use in this match.
     */
    engineOptions: DeepPartial<EngineOptions>;

    /**
     * Whether to run match in secure mode or not
     * @default true
     */
    secureMode: boolean;

    /**
     * Default Agent options to use for all agents in a match. Commonly used for setting resource use boundaries
     */
    agentOptions: DeepPartial<Agent.Options>;

    /**
     * Agent options to override with depending on extension of file
     * @default `{}` - an empty object
     */
    languageSpecificAgentOptions: Agent.LanguageSpecificOptions;

    /**
     * Agent options to lastly overridde with depending on agent index
     * @default `[]` - empty array meaning no more overrides
     */
    agentSpecificOptions: Array<DeepPartial<Agent.Options>>;

    /**
     * Whether or not to store a replay file if match results indicate a replay file was stored
     *
     * @default `true`
     */
    storeReplay: boolean;

    /**
     * Used only when a {@link Storage} plugin is used. Indicates the directory to use to store onto the storage.
     * (Typically some path in the bucket).
     *
     * @default `replays`
     */
    storeReplayDirectory: string;

    /**
     * Whether to store error output for each {@link Match}
     *
     * @default true
     */
    storeErrorLogs: boolean;

    /**
     * Directory to store error logs locally. When a {@link Storage} plugin is used, this indicates the path in the
     * bucket to store the log in, and removes the local copy.
     *
     * @default `errorlogs`
     */
    storeErrorDirectory: string;

    [key: string]: any;
  }
  export enum Status {
    /** Match was created with new but initialize was not called */
    UNINITIALIZED = 'uninitialized',
    /**
     * If the match has been initialized and checks have been passed, the match is ready to run using {@link Match.run}
     */
    READY = 'ready',
    /**
     * If the match is running at the moment
     */
    RUNNING = 'running',
    /**
     * If the match is stopped
     */
    STOPPED = 'stopped',
    /**
     * If the match is completed
     */
    FINISHED = 'finished',
    /**
     * If fatal error occurs in Match, appears when match stops itself
     */
    ERROR = 'error',
  }
}
