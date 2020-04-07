import { Match, MatchConfigs } from '../Match';
import { Design } from '../Design';
import { FatalError } from '../DimensionError';
import { RoundRobinTournament } from './TournamentTypes/RoundRobin';
import { EliminationTournament } from './TournamentTypes/Elimination';
import { DeepPartial } from '../utils/DeepPartial';
import { Logger } from '../Logger';
import { LeaderboardTournament } from './TournamentTypes/Ladder';
import { agentID } from '../Agent';

/**
 * Bot class that persists data for the same ephemereal agent across multiple matches
 */
export class Bot {
  constructor(public tournamentID: Tournament.ID, public file: string) {

  }
}


/**
 * @class Tournament
 * @classdesc The tournament class used to initialize tournaments as well as configure what is publically shown on the 
 * Station
 */
export abstract class Tournament {
  abstract configs: Tournament.TournamentConfigs<unknown>;

  // mapping match ids to active ongoing matches
  public matches: Map<number, Match> = new Map();

  // a queue whose elements are each arrays of bot that are to compete against each other under the `design`
  public matchQueue: Array<Array<Bot>> = [];
  
  // The current status of the tournament
  public status: Tournament.TournamentStatus = Tournament.TournamentStatus.UNINITIALIZED;

  // Ongoing tournament state
  abstract state: unknown;

  // Data to be displayed on to the station
  // public displayState: any;

  public log = new Logger();

  public competitors: Array<Bot> = [];

  private botID = 0;

  constructor(
    protected design: Design,
    files: Array<string> | Array<{file: string, name:string}>, 
    public id: number
  ) {
    files.forEach((file) => {
      this.addBot(file);
    });
  }

  // static create(
  //   design: Design,
  //   files: Array<string> | Array<{file: string, name:string}>, 
  //   // i know this any, any is bad...
  //   tournamentConfigs: DeepPartial<Tournament.TournamentConfigsBase> = {},
  //   id: number
  // ): TournamentBase<unknown, unknown> {
  //   switch(tournamentConfigs.type) {
  //     case TOURNAMENT_TYPE.ROUND_ROBIN:
  //       return new RoundRobinTournament(design, files, tournamentConfigs, id);
  //     case TOURNAMENT_TYPE.ELIMINATION:
  //       return new EliminationTournament(design, files, tournamentConfigs, id);
  //   }
  // }

  public addBot(file: string | {file: string, name: string}) {
    let id = `t${this.id}_${this.botID++}`;
    if (typeof file === 'string') {
      let name = `bot-${id}`;
      this.competitors.push(new Bot({id: id, name: name}, file));
    }
    else {
      this.competitors.push(new Bot({id: id, name: file.name}, file.file));
    }
  }

  // Start the tournament
  abstract run(configs: Tournament.TournamentConfigs<unknown>);

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
          return {file: bot.file, tournamentID: bot.tournamentID}
        });
        match = new Match(this.design, <Array<{file: string, tournamentID: Tournament.ID}>>(filesAndNamesAndIDs), matchConfigs);

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
        resolve({results: results, match: match});
      }
      catch(error) {
        reject(error);
      }
    });
  }
}

export module Tournament {
  export type TournamentClasses = RoundRobinTournament | EliminationTournament | LeaderboardTournament;
  export enum TOURNAMENT_TYPE {
    ROUND_ROBIN = 'round_robin', // can be n-tuple round robin. E.g double roundrobin like most Association Football Leagues
    ELIMINATION = 'elimination', // standard elimination tournament. can be single, double, triple, n-tuple knockout
  }
  export enum TournamentStatus {
    UNINITIALIZED = 'uninitialized',
    STOPPED = 'stopped',
    RUNNING = 'running',
    CRASHED = 'crashed',
  }
  // Required info that will not be deep partialed in the Dimension class
  export interface TournamentConfigsBase {
    defaultMatchConfigs?: DeepPartial<MatchConfigs>
    type: TOURNAMENT_TYPE,
    rankSystem: RANK_SYSTEM,
    // the handler for returning the appropriate numbers given the results returned by getResults
    // is explicitly tied to the rank system chosen if necessary
    resultHandler: (results: any) => any
    rankSystemConfigs?: any
  }
  export interface TournamentConfigs<ConfigType> extends TournamentConfigsBase {
    typeConfigs: ConfigType    
    rankSystemConfigs: any
  }
  export interface TournamentTypeConfig  {

  }
  export interface TournamentTypeState  {
    
  }
  export interface ID {
    id: string
    name: string
  }
  export enum RANK_SYSTEM {
    WINS = 'wins', // ranking by most wins
    ELO = 'elo', // ranking by elo
    TRUESKILL = 'trueskill' // ranking by trueskill
  }
  export namespace RANK_SYSTEM {
    export interface WinConfigs {
      winValue: number
      tieValue: number
      lossValue: number
    }
    export interface WinResults {
      winners: Array<agentID>
      ties: Array<agentID>
      losers: Array<agentID>
    }
    export interface ELOConfigs {

    }
    export interface TrueSkillConfigs {

    }
  }
}