import { Logger} from '../Logger';
import { DeepPartial } from '../utils/DeepPartial';
import { deepMerge } from '../utils/DeepMerge';
import { Match } from '../Match';
import { Station } from '../Station';
import { FatalError } from '../DimensionError';
import { Design } from '../Design';
import { RoundRobinTournament } from '../Tournament/TournamentTypes/RoundRobin';
import { EliminationTournament } from '../Tournament/TournamentTypes/Elimination';
import { Tournament } from '../Tournament';
import { deepCopy } from '../utils/DeepCopy';
import { LadderTournament } from '../Tournament/TournamentTypes/Ladder';

/**
 * Dimension configurations
 */
export type DimensionConfigs = {
  /** Name of the dimension */
  name: string
  /** Whether or not to activate the Station */
  activateStation: boolean
  /** Whether the station should observe this Dimension */
  observe: boolean,
  /** The logging level for this Dimension */
  loggingLevel: Logger.LEVEL,
  /** The default match configurations to use when creating matches using this Dimension */
  defaultMatchConfigs: DeepPartial<Match.Configs>
}
/**
 * @class Dimension
 * @classdesc The Dimension framework for intiating a {@link Design} to then run instances of {@link Match} on.
 */
export class Dimension {
  
  /**
   * The matches running in this Dimension
   */
  public matches: Array<Match> = [];

  /**
   * Tounraments in this Dimension.
   */
  public tournaments: Array<Tournament> = [];

  static id: number = 0;

  /**
   * This Dimension's name
   */
  public name: string;

  /**
   * This dimension's ID
   */
  public id: number = 0;

  /**
   * Logger
   */
  public log = new Logger();

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
   * Dimension configs
   */
  public configs: DimensionConfigs = {
    name: '',
    activateStation: true,
    observe: true,
    loggingLevel: Logger.LEVEL.INFO,
    defaultMatchConfigs: {
      dimensionID: this.id
    }
  }

  constructor(public design: Design, configs: DeepPartial<DimensionConfigs> = {}) {

    // override configs with user provided configs
    this.configs = deepMerge(this.configs, configs);

    this.log.level = this.configs.loggingLevel;

    // open up a new station for the current node process if it hasn't been opened yet and there is a dimension that 
    // is asking for a station to be initiated
    if ((this.configs.activateStation === true && this.configs.observe === true) && Dimension.Station == null) {
      Dimension.Station = new Station('Dimension Station', [], this.configs.loggingLevel);
    }
    this.log.info('Dimension Configs', this.configs);
    
    // default match log level and design log level is the same as passed into the dimension
    this.configs.defaultMatchConfigs.loggingLevel = this.configs.loggingLevel;
    this.design._setLogLevel(this.configs.loggingLevel);

    // set name
    if (this.configs.name) {
      this.name = this.configs.name;
    }
    else {
      this.name = `dimension_${Dimension.id}`;
    }
    this.id = Dimension.id;
    this.log.detail(`Created Dimension: ` + this.name);
    Dimension.id++;

    // make the station observe this dimension when this dimension is created
    if (this.configs.observe === true) Dimension.Station.observe(this);

    // by default link all matches created by this dimension to this dimension
    this.configs.defaultMatchConfigs.dimensionID = this.id;
  }
  /**
   * Create a match with the given files with the given unique name. It rejects if a fatal error occurs and resolves 
   * with the initialized `match` object as specified by the `Design` of this `Dimension`
   * 
   * @param files - List of files to use to generate agents and use for a new match
   * @param matchOptions - Options for the created match
   * @param configs - Configurations that are `Design` dependent
   */
  public async createMatch(files: Array<string> | Array<{file: string, name: string}>, 
    configs?: DeepPartial<Match.Configs>): Promise<Match> {
    return new Promise( async (resolve, reject) => {
      if (!files.length) reject(new FatalError('No files provided for match'));

      // override dimension defaults with provided configs
      // TOOD: change to deep copy
      let matchConfigs = deepCopy(this.configs.defaultMatchConfigs);
      matchConfigs = deepMerge(matchConfigs, configs);

      // create new match
      let match: Match;
      if (typeof files[0] === 'string') {
        match = new Match(this.design, <Array<string>> files, matchConfigs);
      } else {
        match = new Match(this.design, <Array<{file: string, name: string}>> files, matchConfigs);
      }
      this.statistics.matchesCreated++;

      // store match into dimension
      this.matches.push(match);

      // Initialize match with initialization configuration
      try {
        await match.initialize();
      }
      catch(error) {
        reject(error);
      }
      
      resolve(match);
    });
  }

  /**
   * Runs a match with the given files with the given unique name. It rejects if a fatal error occurs and resolves 
   * with the results of the match as specified by the `Design` of this `Dimension`
   * 
   * @param files - List of files to use to generate agents and use for a new match
   * @param matchOptions - Options for the created match
   * @param configs - Configurations that are `Design` dependent. These configs are passed into `Design.initialize`
   * `Design.update` and `Design.storeResults`
   */
  public async runMatch(
    files: Array<string> | Array<{file: string, name: string}>, 
    configs?: DeepPartial<Match.Configs>): Promise<any> {
    return new Promise( async (resolve, reject) => {
      
      try {
        if (!files.length) reject (new FatalError('No files provided for match'));

        // override dimension defaults with provided configs
        let matchConfigs = deepCopy(this.configs.defaultMatchConfigs);
        matchConfigs = deepMerge(matchConfigs, configs);
        
        let match: Match;
        if (typeof files[0] === 'string') {
          match = new Match(this.design, <Array<string>> files, matchConfigs);
        } else {
          match = new Match(this.design, <Array<{file: string, name: string}>> files, matchConfigs);
        }
        this.statistics.matchesCreated++;

        // store match into dimension
        this.matches.push(match);

        // Initialize match with initialization configuration
        await match.initialize();

        // Get results
        let results = await match.run();

        // Resolve the results
        resolve(results);
      }
      catch(error) {
        reject(error);
      }
      
    });
  }

  /**
   * Create a tournament
   * @param files - The initial files to make competitors in this tournament
   * @param configs - Configuration for the tournament
   * 
   * @see {@link Tournament} for the different tournament types
   * @returns a Tournament of the specified type
   */
  public createTournament(files: Array<string> | Array<{file: string, name:string}>, configs: Tournament.TournamentConfigsBase): Tournament {
      let id = this.statistics.tournamentsCreated;
      let newTourney;
      switch(configs.type) {
        case Tournament.TOURNAMENT_TYPE.ROUND_ROBIN:
          newTourney = new RoundRobinTournament(this.design, files, configs, id);
          break;
        case Tournament.TOURNAMENT_TYPE.LADDER:
          newTourney = new LadderTournament(this.design, files, configs, id);
          break;
        case Tournament.TOURNAMENT_TYPE.ELIMINATION:
          newTourney = new EliminationTournament(this.design, files, configs, id);
          break;
      }
      this.statistics.tournamentsCreated++;
      this.tournaments.push(newTourney);
      return newTourney;
  }
  // TODO give option to directly create a Ladder/RoundRobin ... tourney with createLadderTournament etc.

  /**
   * Get the station
   */
  getStation() {
    return Dimension.Station;
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