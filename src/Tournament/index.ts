import { Match, MatchConfigs } from '../Match';
import { Design } from '../Design';
import { FatalError } from '../DimensionError';
import { RoundRobinTournament as _RoundRobinTournament } from './TournamentTypes/RoundRobin';
import { EliminationTournament as _EliminationTournament } from './TournamentTypes/Elimination';
import { DeepPartial } from '../utils/DeepPartial';
import { Logger, LoggerLEVEL } from '../Logger';
import { LadderTournament as _LadderTournament } from './TournamentTypes/Ladder';
import { agentID } from '../Agent';
import { deepCopy } from '../utils/DeepCopy';

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

  public name = '';

  constructor(
    protected design: Design,
    files: Array<string> | Array<{file: string, name:string}>, 
    public id: number,
    tournamentConfigs: Tournament.TournamentConfigsBase
  ) {
    files.forEach((file) => {
      this.addBot(file);
    });
    this.log.level = (tournamentConfigs.loggingLevel !== undefined) ? tournamentConfigs.loggingLevel : LoggerLEVEL.INFO;
    this.name = tournamentConfigs.name ? tournamentConfigs.name : `tournament_${this.id}`;
    this.log.identifier = this.name;
  }

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
  abstract async run(configs?: DeepPartial<Tournament.TournamentConfigsBase>): Promise<any>;

  /**
   * Stops the tournament while running
   */
  public abstract async stop();

  /**
   * Resumes the tournament
   */
  public abstract async resume();

  /**
   * Retrieve some form of rankings from the tournament's current state
   */
  public abstract getRankings()

  /**
   * Set configs for this tournament
   * @param configs the configs to deep merge with the current configs
   */
  abstract setConfigs(configs: DeepPartial<Tournament.TournamentConfigsBase>): void

  /**
   * Set configs for this tournament
   * @param configs the configs to deep merge with the current configs
   */
  abstract getConfigs(): Tournament.TournamentConfigsBase

  /**
   * 
   * @param bots - the bots to run
   * @returns a promise that resolves with the results and the associated match
   */
  protected async runMatch(bots: Array<Bot>): Promise<{results: any, match: Match}> {
    return new Promise( async (resolve, reject) => {
      try {
        if (!bots.length) reject (new FatalError('No bots provided for match'));

        let matchConfigs = deepCopy(this.getConfigs().defaultMatchConfigs);
        
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
  export type RoundRobinTournament = _RoundRobinTournament;
  export type EliminationTournament = _EliminationTournament;
  export type LadderTournament = _LadderTournament;

  export enum TOURNAMENT_TYPE {
    ROUND_ROBIN = 'round_robin', // can be n-tuple round robin. E.g double roundrobin like most Association Football Leagues
    ELIMINATION = 'elimination', // standard elimination tournament. can be single, double, triple, n-tuple knockout
    LADDER = 'ladder', // like halite
  }
  export enum TournamentStatus {
    UNINITIALIZED = 'uninitialized',
    INITIALIZED = 'initialized',
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
    rankSystemConfigs?: any,
    loggingLevel?: LoggerLEVEL
    name?: string
    tournamentConfigs?: any
    agentsPerMatch: Array<number> // an array of valid players per match
    consoleDisplay?: boolean
  }
  export interface TournamentConfigs<ConfigType> extends TournamentConfigsBase {
    tournamentConfigs: ConfigType    
    rankSystemConfigs: any
  }
  export interface TournamentTypeConfig  {

  }
  export interface TournamentTypeState  {
    
  }
  // Bot ID
  export interface ID {
    id: string
    name: string
  }
  export enum RANK_SYSTEM {
    WINS = 'wins', // ranking by most wins
    ELO = 'elo', // ranking by elo
    TRUESKILL = 'trueskill' // ranking by trueskill
  }
  export module RANK_SYSTEM {
    export interface WinConfigs {
      winValue: number
      tieValue: number
      lossValue: number,
      ascending: boolean
    }
    export interface WinResults {
      winners: Array<agentID>
      ties: Array<agentID>
      losers: Array<agentID>
    }
    export interface ELOConfigs {

    }
    export interface ELOResults {
      ranks: Array<{rank: number, agentID: agentID}> // ranks of agents, where rank 1 is highest
    }
    export interface TrueSkillConfigs {

    }
    export interface TrueSkillResults {
      ranks: Array<{rank: number, agentID: agentID}> // ranks of agents, where rank 1 is highest
    }
    export interface TrueSkillRankState {
      mu: number,
      sigma: number
    }
  }
  export interface RoundRobinConfigs extends Tournament.TournamentTypeConfig {
    times: number
  }
  export interface RoundRobinState extends Tournament.TournamentTypeState {
    botStats: Map<string, {bot: Bot, wins: number, ties: number, losses: number, matchesPlayed: number}>
    statistics: {
      totalMatches: number
    }
    results: Array<any>
  }
  // Configs specific to ladder like tournaments, e.g. halite, chess
  export interface LadderConfigs extends Tournament.TournamentTypeConfig {
    maxConcurrentMatches: number // max matches that can run concurrently on one node instance
    endDate: Date // the date to stop running this tournament once it is started. If null, no end date
  }
  export interface LadderState extends Tournament.TournamentTypeState {
    // maps tournamentID.id to object with bot info, wins/ties/losses and matches played along with rank state dependent 
    // ranking system used
    botStats: Map<string, {bot: Bot, wins: number, ties: number, losses: number, matchesPlayed: number, rankState: any}>
    statistics: {
      totalMatches: number
    }
    currentRanks: Array<{bot: Bot, rankState: any}>
    results: Array<any>
  }
}