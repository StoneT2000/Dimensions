import { Logger, LoggerLEVEL} from '../Logger';
import { DeepPartial } from '../utils/DeepPartial';
import { deepMerge } from '../utils/DeepMerge';
import { Tournament } from '../Tournament';
import * as TournamentTypes from '../Tournament/TournamentTypes';
import { MatchConfigs, Match } from '../Match';
import { Station } from '../Station';
import { FatalError } from '../DimensionError';
import { Design } from '../Design';

export type DimensionConfigs = {
  name: string
  activateStation: boolean
  observe: boolean,
  loggingLevel: LoggerLEVEL,
  defaultMatchConfigs: Partial<MatchConfigs>
}
/**
 * @class Dimension
 * @classdesc The Dimension framework for intiating a `Design` to then run `Matches` on. Interacts with `Match` class
 * only
 * 
 * @param design - The design to use for this dimension
 * @param configs - Dimension configurations
 * @param configs.name - The optional name for the dimension
 * @param configs.loggingLevel - The logging level to be set as the default for all components in the Dimension, 
 *                               including matches, the design, and the match engine
 * @param configs.observe - Whether or not this dimension should be observed. If set to true, a station will initialized
 *                          to observe thihs dimension automatically
 * @param configs.activateStation - Whether or not a station should be activated and intialized. If configs.observe or 
 *                                  configs.activateStation are true, a station will be initialized .
 */
export class Dimension {
  
  public matches: Array<Match> = [];

  public tournaments: Array<Tournament> = [];

  static id: number = 0;
  public name: string;
  public id: number = 0;

  public log = new Logger();

  // Default station for current node instance
  public static Station: Station = null;

  public statistics = {
    tournamentsCreated: 0,
    matchesCreated: 0,
  }

  // default configs
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
    Object.assign(this.configs, configs);

    this.log.level = this.configs.loggingLevel;

    // open up a new station for the current node process if it hasn't been opened yet and there is a dimension that 
    // is asking for a station to be initiated
    if ((this.configs.activateStation === true || this.configs.observe === true) && Dimension.Station == null) {
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
  public async createMatch(files: Array<string> | Array<{file: string, name: string}>, configs?: DeepPartial<MatchConfigs>): Promise<Match> {
    return new Promise( async (resolve, reject) => {
      if (!files.length) reject(new FatalError('No files provided for match'));

      // override dimension defaults with provided configs
      // TOOD: change to deep copy
      let matchConfigs = {...this.configs.defaultMatchConfigs};
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
  public async runMatch(files: Array<string> | Array<{file: string, name: string}>, configs?: DeepPartial<MatchConfigs>) {
    return new Promise( async (resolve, reject) => {
      
      try {
        if (!files.length) reject (new FatalError('No files provided for match'));

        // override dimension defaults with provided configs
        // TOOD: change to deep copy
        let matchConfigs = {...this.configs.defaultMatchConfigs};
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
   * 
   */
  public async createTournament(files: Array<string> | Array<{file: string, name:string}>, configs?: DeepPartial<TournamentTypes.TournamentConfigsBase>): Promise<Tournament> {
    return new Promise( async (resolve, reject) => {
      let newTourney = Tournament.create(this.design, files, configs, this.statistics.tournamentsCreated);
      this.statistics.tournamentsCreated++;
      this.tournaments.push(newTourney);
      resolve(newTourney);
    });
  }

}

/**
 * Creates a dimension for use to start matches, run tournaments, etc.
 * @param design The design to use
 * @param name The optional name of the dimension
 */
export function create(design: Design, configs?: DeepPartial<DimensionConfigs>): Dimension {
  return new Dimension(design, configs);
}