import { MatchConfigs, Match } from "../Match";
import { DeepPartial } from "../utils/DeepPartial";
import { deepMerge } from "../utils/DeepMerge";
import { FatalError } from "../DimensionError";
import { Design } from "../Design";

import * as TournamentTypes from './TournamentTypes';
import * as EliminationTypes from './TournamentTypes/Elimination';
import * as RoundRobinTypes from './TournamentTypes/RoundRobin';

let TOURNAMENT_TYPE = TournamentTypes.TOURNAMENT_TYPE;
type TournamentConfigs<T,V> = TournamentTypes.TournamentConfigs<T,V>;

/**
 * Bot class that persists data for the same ephemereal agent across multiple matches
 */
export class Bot {
  constructor(public tournamentID: string, public file: string, public name: string) {

  }
}

export class Tournament {

  static create(
    design: Design,
    files: Array<string> | Array<{file: string, name:string}>, 
    // i know this any, any is bad...
    tournamentConfigs: DeepPartial<TournamentTypes.TournamentConfigsBase> = {},
    id: number
  ): RoundRobinTournament | EliminationTournament {
    switch(tournamentConfigs.type) {
      case TOURNAMENT_TYPE.ROUND_ROBIN:
        return new RoundRobinTournament(design, files, tournamentConfigs, id);
      case TOURNAMENT_TYPE.ELIMINATION:
        return new EliminationTournament(design, files, tournamentConfigs, id);
    }
  }
}
/**
 * @class Tournament
 * @classdesc The tournament class used to initialize tournaments as well as configure what is publically shown on the 
 * Station
 */
export class TournamentBase<ConfigType, StateType> {
  public configs: TournamentConfigs<ConfigType, StateType> = {
    defaultMatchConfigs: {},
    type: TOURNAMENT_TYPE.ROUND_ROBIN,
    typeConfigs: null,
    resultHandler: () => {}
  }

  // mapping match ids to active ongoing matches
  public matches: Map<number, Match>;

  // a queue whose elements are each arrays of bot that are to compete against each other under the `design`
  public matchQueue: Array<Array<Bot>>;
  
  // The current status of the tournament
  public status: TournamentTypes.TournamentStatus

  // Ongoing tournament state
  public state: StateType;

  // Data to be displayed on to the station
  // public displayState: any;

  public competitorSources: Array<Bot>

  private botID = 0;

  constructor(
    protected design: Design,
    files: Array<string> | Array<{file: string, name:string}>, 
    tournamentConfigs: DeepPartial<TournamentConfigs<ConfigType, StateType>> = {},
    public id: number
  ) {
    this.configs = deepMerge(this.configs, tournamentConfigs);

    files.forEach((file) => {
      this.addBot(file);
    });
  }

  public addBot(file: string | {file: string, name: string}) {
    let id = `t${this.id}_${this.botID++}`;
    if (typeof file === 'string') {
      let name = `bot-${id}`;
      this.competitorSources.push(new Bot(id, file, name));
    }
    else {
      this.competitorSources.push(new Bot(id, file.file, file.name));
    }
  }

  /**
   * Start the tournament
   */
  public async start(configs?: DeepPartial<TournamentConfigs<ConfigType, StateType>>) {
    this.configs = deepMerge(this.configs, configs);
    switch (this.configs.type) {
      case TOURNAMENT_TYPE.ELIMINATION:
        break;
      case TOURNAMENT_TYPE.ROUND_ROBIN:
        break;
    }
  }

  /**
   * Stops the tournament while running
   */
  public async stop() {

  }

  /**
   * Resumes the tournament
   */
  public async resume() {

  }

  /**
   * 
   * @param bots - the bots to run
   * @returns a promise that resolves with the results and the associated match
   */
  protected async runMatch(bots: Array<Bot>): Promise<{results: any, match: Match}> {
    return new Promise( async (resolve, reject) => {
      try {
        if (!bots.length) reject (new FatalError('No bots provided for match'));

        let matchConfigs = {...this.configs.defaultMatchConfigs};
        
        let match: Match;
        let filesAndNamesAndIDs = bots.map((bot) => {
          return {file: bot.file, name: bot.name, tournamentID: bot.tournamentID}
        });
        match = new Match(this.design, <Array<{file: string, name: string, tournamentID: string}>>(filesAndNamesAndIDs), matchConfigs);

        // store match into the tournament
        this.matches.set(match.id, match);

        // Initialize match with initialization configuration
        await match.initialize();

        // Get results
        let results = await match.run();

        // remove the match from the active matches list
        this.matches.delete(match.id);
        // TODO: Add option to just archive matches instead
        
        // Resolve the results
        resolve(results);
      }
      catch(error) {
        reject(error);
      }
    });
  }
}

class EliminationTournament extends TournamentBase<EliminationTypes.Configs, EliminationTypes.State> {
  constructor(
    design: Design,
    files: Array<string> | Array<{file: string, name:string}>, 
    tournamentConfigs: DeepPartial<TournamentConfigs<EliminationTypes.Configs, EliminationTypes.State>> = {},
    id: number
  ) {
    super(design, files, tournamentConfigs, id);
  }
}

class RoundRobinTournament extends TournamentBase<RoundRobinTypes.Configs, RoundRobinTypes.State> {
  constructor(
    design: Design,
    files: Array<string> | Array<{file: string, name:string}>, 
    tournamentConfigs: DeepPartial<TournamentConfigs<RoundRobinTypes.Configs, RoundRobinTypes.State>> = {},
    id: number
  ) {
    super(design, files, tournamentConfigs, id);
    
  }
}