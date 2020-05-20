import { exec } from 'child_process';

import { DeepPartial } from '../utils/DeepPartial';
import { deepMerge } from '../utils/DeepMerge';
import { genID } from '../utils';
import { deepCopy } from '../utils/DeepCopy';

import { Logger} from '../Logger';
import { Match } from '../Match';
import { Station } from '../Station';
import { FatalError, MissingFilesError, NotSupportedError } from '../DimensionError';
import { Design } from '../Design';
import { Tournament } from '../Tournament';

import { BOT_USER } from '../MatchEngine';
import { Plugin } from '../Plugin';
import { Database } from '../Plugin/Database';
import { Storage } from '../Plugin/Storage';



/**
 * Some standard database type strings
 */
export enum DatabaseType {
  /**
   * Represents no database used
   */
  NONE = 'none',
  /**
   * Represents mongodb database used
   */
  MONGO = 'mongo'
}
export enum StorageType {
  /**
   * Represents no storage used, all files stored locally on devide
   */
  NONE = 'none',
  /**
   * Represents gcloud storage used
   */
  GCLOUD = 'gcloud'
}

/**
 * An id generated using nanoid
 */
export type NanoID = string;

/**
 * Dimension configurations
 */
export interface DimensionConfigs {
  /** Name of the dimension */
  name: string
  /** 
   * Whether or not to activate the Station 
   * @default `true`
   */
  activateStation: boolean
  /** 
   * Whether the station should observe this Dimension 
   * @default `true`
   */
  observe: boolean,
  /** The logging level for this Dimension */
  loggingLevel: Logger.LEVEL,
  /** The default match configurations to use when creating matches using this Dimension */
  defaultMatchConfigs: DeepPartial<Match.Configs>,

  /** An overriding ID to use for the dimension instead of generating a new one */
  id: NanoID,

  /**
   * Whether to run Dimension in a more secure environment.
   * Requires rbash and setting up users beforehand and running dimensions in sudo mode
   * @default `false`
   */
  secureMode: boolean,

  /**
   * String denoting what kind of backing database is being used
   * @default {@link DatabaseType.NONE}
   */
  backingDatabase: string | DatabaseType

  /**
   * String denoting what kind of backing storage is being used
   * @default {@link DatabaseType.NONE}
   */
  backingStorage: string | StorageType
}
/**
 * The Dimension framework for intiating a {@link Design} to then run instances of a {@link Match} or 
 * {@link Tournament} on.
 */
export class Dimension {
  
  /**
   * A map of the matches running in this Dimension
   */
  public matches: Map<NanoID, Match> = new Map();

  /**
   * A map of the tournaments in this Dimension.
   */
  public tournaments: Map<NanoID, Tournament> = new Map();

  /**
   * This Dimension's name
   */
  public name: string;

  /**
   * This dimension's ID. It is always a 6 character NanoID unless overrided through the {@link DimensionConfigs}
   */
  public id: NanoID;

  /**
   * Logger
   */
  public log = new Logger();

  /**
   * The database plugin being used. Allows Dimensions to interact with a database and store {@link Match}, 
   * {@link Tournament}, and user data, allowing for data persistance across instances.
   */
  public databasePlugin: Database;

  /**
   * The storage plugin being used. Allows Dimensions to interact with a storage service and store user object data,
   * particuarly bot file uploads
   */
  public storagePlugin: Storage;

  /**
   * The Station associated with this Dimension and current node instance
   */
  public static Station: Station = null;

  /**
   * Stats
   */
  public statistics = {
    tournamentsCreated: 0,
    matchesCreated: 0,
  }

  /**
   * Dimension configs. Set to defaults
   */
  public configs: DimensionConfigs = {
    name: '',
    activateStation: true,
    observe: true,
    loggingLevel: Logger.LEVEL.INFO,
    defaultMatchConfigs: {
      secureMode: false
    },
    secureMode: false,
    backingDatabase: DatabaseType.NONE,
    backingStorage: StorageType.NONE,
    id: 'oLBptg'
  }

  /**
   * Indicator of whether cleanup was called already or not
   */
  private cleaningUp: Promise<any> = null;

  constructor(public design: Design, configs: DeepPartial<DimensionConfigs> = {}) {

    // override configs with user provided configs
    this.configs = deepMerge(this.configs, configs);
    
    // generate ID if not provided
    if (!configs.id) {
      this.id = Dimension.genDimensionID();
    }
    else {
      this.id = configs.id;
    }
    
    this.log.level = this.configs.loggingLevel;
    

    // open up a new station for the current node process if it hasn't been opened yet and there is a dimension that 
    // is asking for a station to be initiated
    if (this.configs.activateStation === true && Dimension.Station == null) {
      Dimension.Station = new Station('Station', [], this.configs.loggingLevel);
    }

    // default match log level and design log level is the same as passed into the dimension
    this.configs.defaultMatchConfigs.loggingLevel = this.configs.loggingLevel;
    this.design.setLogLevel(this.configs.loggingLevel);
    
    // set name
    if (this.configs.name) {
      this.name = this.configs.name;
    }
    else {
      this.name = `dimension_${this.id}`;
    }
    this.log.identifier = `${this.name} Log`

    // log important messages regarding security
    if (this.configs.secureMode) {
      try {
        this.setupSecurity();
      }
      catch(error) {
        throw error;
      }
    }
    else {
      this.log.error(`WARNING: Running in non-secure mode. You will not be protected against malicious bots`);
    }
    // setting securemode in dimension config also sets it for default match configs
    this.configs.defaultMatchConfigs.secureMode = this.configs.secureMode;
    
    // set up cleanup functions
    process.on("exit", async () => {
      await this.cleanup();
      process.exit();
    });
    
    process.on("SIGINT", async () => {
      await this.cleanup();
      process.exit();
    });

    // make the station observe this dimension when this dimension is created
    if (this.configs.observe === true && Dimension.Station != null) Dimension.Station.observe(this);

    this.log.info(`Created Dimension - ID: ${this.id}, Name: ${this.name}`);
    this.log.detail('Dimension Configs', this.configs);
  }

  /**
   * Create a match with the given files and any optional {@link Match.Configs}. Resolves with the initialized 
   * {@link Match} object as specified by the {@link Design} of this {@link Dimension}
   * 
   * Rejects if an error occurs.
   * 
   * @param files - List of files or objects to use to generate agents and use for a new match
   * @param matchOptions - Options for the created match
   * @param configs - Configurations that are {@link Design} dependent
   */
  public async createMatch(files: Array<string> | Array<{file: string, name: string, botkey?: string}>, 
    configs?: DeepPartial<Match.Configs>): Promise<Match> {

    if (!files.length) {
      throw new MissingFilesError('No files provided for match');
    }

    // override dimension defaults with provided configs
    let matchConfigs = deepCopy(this.configs.defaultMatchConfigs);
    matchConfigs = deepMerge(matchConfigs, configs);

    // create new match
    let match: Match;
    if (typeof files[0] === 'string') {
      match = new Match(this.design, <Array<string>> files, matchConfigs, this);
    } else {
      match = new Match(this.design, <Array<{file: string, name: string, botkey?: string}>> files, matchConfigs, this);
    }
    this.statistics.matchesCreated++;

    // store match into dimension
    this.matches.set(match.id, match);

    // Initialize match and return it
    await match.initialize();
    return match;
  }

  /**
   * Runs a match with the given files and any optional {@link Match.Configs}. It rejects if an error occurs. Some 
   * errors include {@link MatchDestroyedError} which happens when {@link Match.destroy} is called.
   * 
   * This also automatically stores matches into the {@link Database} if database is active and configured to save
   * 
   * Resolves with the results of the match as specified by the {@link Design} of this {@link Dimension}
   * 
   * @param files - List of files or objects to use to generate agents and use for a new match
   * @param matchOptions - Options for the created match
   * @param configs - Configurations that are `Design` dependent. These configs are passed into `Design.initialize`
   * `Design.update` and `Design.storeResults`
   */
  public async runMatch(
    files: Array<string> | Array<{file: string, name: string, botkey?: string}>, 
    configs?: DeepPartial<Match.Configs>
  ): Promise<any> {
    if (!files.length) throw new MissingFilesError('No files provided for match');

    // override dimension defaults with provided configs
    let matchConfigs: Match.Configs = deepCopy(this.configs.defaultMatchConfigs);
    matchConfigs = deepMerge(matchConfigs, configs);

    let match: Match;
    if (typeof files[0] === 'string') {
      match = new Match(this.design, <Array<string>> files, matchConfigs, this);
    } else {
      match = new Match(this.design, <Array<{file: string, name: string, botkey?: string}>> files, matchConfigs, this);
    }
    this.statistics.matchesCreated++;

    // store match into dimension (caching)
    this.matches.set(match.id, match);

    // Initialize match with initialization configuration
    await match.initialize();

    // Get results
    let results = await match.run();

    // if database plugin is active and saveMatches is set to true, store match
    if (this.hasDatabase()) {
      if (this.databasePlugin.configs.saveMatches) {
        this.databasePlugin.storeMatch(match, this.id);
      }
    }

    // Return the results
    return results
  }

  /**
   * Create a tournament
   * 
   * @param files - The initial files to make competitors in this tournament. Can also specify the name and an 
   * existingID, which is the playerID. If database is used, this existingID is used to find the assocciated user with
   * this ID.
   * 
   * @param configs - Configuration for the tournament
   * 
   * @see {@link Tournament} for the different tournament types
   * @returns a Tournament of the specified type
   */
  public createTournament(
    files: Array<string> | Array<{file: string, name: string, existingId?: string}>,
    configs: Tournament.TournamentConfigsBase
  ): Tournament {
      let id = Tournament.genTournamentClassID();
      let newTourney: Tournament;
      if (configs.loggingLevel === undefined) {
        // set default logging level to that of the dimension
        configs.loggingLevel = this.log.level;
      }

      // merge default match configs from dimension
      let dimensionDefaultMatchConfigs = deepCopy(this.configs.defaultMatchConfigs);
      configs = deepMerge({defaultMatchConfigs: dimensionDefaultMatchConfigs}, configs);
      
      switch(configs.type) {
        case Tournament.Type.ROUND_ROBIN:
          newTourney = new Tournament.RoundRobin(this.design, files, configs, id, this);
          break;
        case Tournament.Type.LADDER:
          newTourney = new Tournament.Ladder(this.design, files, configs, id, this);
          break;
        case Tournament.Type.ELIMINATION:
          newTourney = new Tournament.Elimination(this.design, files, configs, id, this);
          break;
      }
      this.statistics.tournamentsCreated++;
      this.tournaments.set(newTourney.id, newTourney);
      return newTourney;
  }
  // TODO give option to directly create a Ladder/RoundRobin ... tourney with createLadderTournament etc.

  /**
   * Get the station
   */
  getStation(): Station {
    return Dimension.Station;
  }

  /**
   * Removes a match by id. Returns true if removed, false if nothing was removed
   */
  public async removeMatch(matchID: NanoID) {
    if (this.matches.has(matchID)) {
      let match = this.matches.get(matchID);
      await match.destroy();
      return this.matches.delete(matchID);
    }
    return false;
  }

  /**
   * Sets up necessary security and checks if everything is in place
   */
  private async setupSecurity() {

    // perform checks
    try {
      this.checkForUsers([BOT_USER]);
    }
    catch (error) {
      throw error;
    }
  }

  /**
   * Checks if the provided users exist in this system or not.
   * @param usernames - usernames of the users to check for
   */
  private checkForUsers(usernames: Array<string>) {
    return new Promise((resolve, reject) => {

      let userset = new Set();
      switch(process.platform) {
        case 'darwin': {
          let p = exec(`dscacheutil -q user`, (err) => {
            if (err) throw err;
          });
          p.stdout.on('data', (chunk) => {
            `${chunk}`.split('\n').forEach((line) => {
              if (line.slice(0, 4) === 'name') {
                userset.add(line.slice(6));
              }
            });
          });
          p.on('close', (code) => {
            for (let i = 0; i < usernames.length; i++) {
              let name = usernames[i];
              if (!userset.has(name)) {
                throw new FatalError(`Missing user: ${name} \nPlease add that user to your system (do not make it admin)`);
              }
            }
            resolve();
          });
          break;
        }
        case 'linux': {
          exec(`awk -F: '{ print $1}' /etc/passwd`, (err, stdout) => {
            if (err) throw err;
            `${stdout}`.split('\n').forEach((line) => {
              userset.add(line);
            });
            for (let i = 0; i < usernames.length; i++) {
              let name = usernames[i];
              if (!userset.has(name)) {
                throw new FatalError(`Missing user: ${name}. Please add that user to your system (do not make it admin)`);
              }
            }
            resolve();
          });
          break;
        }
        default:
          throw new NotSupportedError(`The platform ${process.platform} is not supported yet for secureMode`);
      }
      
    });
  }

  /**
   * Generates a 6 character nanoID string for identifying dimensions
   */
  public static genDimensionID() {
    return genID(6);
  }

  /**
   * Uses a particular plugin in the dimensions framework.
   * 
   * @param plugin - the plugin
   */
  public async use(plugin: Plugin) {
    switch(plugin.type) {
      case Plugin.Type.DATABASE:
        this.log.info('Attaching Database Plugin ' + plugin.name);
        // set to unknown to tell dimensions that there is some kind of database, we dont what it is yet
        this.configs.backingDatabase = 'unknown';
        this.databasePlugin = <Database>plugin;
        await this.databasePlugin.initialize(this);
        break;
      case Plugin.Type.STORAGE:
        this.log.info('Attaching Storage Plugin ' + plugin.name);
        this.configs.backingStorage = 'unknown;'
        this.storagePlugin = <Storage>plugin;
        await this.storagePlugin.initialize(this);
      default:
        break;
    }
    await plugin.manipulate(this);
  }

  /**
   * Returns true if dimension has a database backing it
   */
  public hasDatabase() {
    return this.databasePlugin && this.configs.backingDatabase !== DatabaseType.NONE;
  }

  /**
   * Returns true if dimension has a storage plugin backing it
   */
  public hasStorage() {
    return this.storagePlugin && this.configs.backingStorage !== StorageType.NONE;
  }

  /**
   * Cleanup function to run right before process exits
   */
  private async cleanup() {
    if (this.cleaningUp) {
      return this.cleaningUp;
    }
    this.log.info('Cleaning up');
    let cleanUpPromises: Array<Promise<void>> = [];
    this.matches.forEach((match) => {
      cleanUpPromises.push(match.destroy());
    });
    this.tournaments.forEach((tournament) => {
      cleanUpPromises.push(tournament.destroy());
    });
    if (this.getStation()) {
      cleanUpPromises.push(this.getStation().stop());
    }
    this.cleaningUp = Promise.all(cleanUpPromises);
    await this.cleaningUp;
  }

}

/**
 * Creates a dimension for use to start matches, run tournaments, etc.
 * @param design - the design to use
 * @param configs - optional configurations for the dimension
 */
export function create(design: Design, configs?: DeepPartial<DimensionConfigs>): Dimension {
  return new Dimension(design, configs);
}