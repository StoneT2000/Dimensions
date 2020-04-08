import { Match, MatchConfigs } from '../Match';
import { Design } from '../Design';
import { FatalError } from '../DimensionError';
import { RoundRobinTournament } from './TournamentTypes/RoundRobin';
import { EliminationTournament } from './TournamentTypes/Elimination';
import { DeepPartial } from '../utils/DeepPartial';
import { Logger } from '../Logger';
import { LadderTournament } from './TournamentTypes/Ladder';
import { agentID } from '../Agent';
import { deepCopy } from '../utils/DeepCopy';

/**
 * Player class that persists data for the same ephemereal agent across multiple matches
 */
export class Player {
  constructor(public tournamentID: Tournament.ID, public file: string) {

  }
}


/**
 * Abstract Tournament
 * The tournament class used to initialize tournaments as well as configure what is publically shown on the 
 * Station
 */
export abstract class Tournament {

  // mapping match ids to active ongoing matches
  public matches: Map<number, Match> = new Map();

  // a queue whose elements are each arrays of player that are to compete against each other under the `design`
  public matchQueue: Array<Array<Player>> = [];
  
  // The current status of the tournament
  public status: Tournament.TournamentStatus = Tournament.TournamentStatus.UNINITIALIZED;

  // Ongoing tournament state
  abstract state: unknown;

  // Data to be displayed on to the station
  // public displayState: any;

  public log = new Logger();

  public competitors: Array<Player> = [];

  private playerID = 0;

  public name = '';

  constructor(
    protected design: Design,
    files: Array<string> | Array<{file: string, name:string}>, 
    public id: number,
    tournamentConfigs: Tournament.TournamentConfigsBase
  ) {
    files.forEach((file) => {
      this.addplayer(file);
    });
    this.log.level = (tournamentConfigs.loggingLevel !== undefined) ? tournamentConfigs.loggingLevel : Logger.LEVEL.INFO;
    this.name = tournamentConfigs.name ? tournamentConfigs.name : `tournament_${this.id}`;
    this.log.identifier = this.name;
  }

  public addplayer(file: string | {file: string, name: string}) {
    let id = `t${this.id}_${this.playerID++}`;
    if (typeof file === 'string') {
      let name = `player-${id}`;
      this.competitors.push(new Player({id: id, name: name}, file));
    }
    else {
      this.competitors.push(new Player({id: id, name: file.name}, file.file));
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
   * @param players - the players to compete together
   * @returns a promise that resolves with the results and the associated match
   */
  protected async runMatch(players: Array<Player>): Promise<{results: any, match: Match}> {
    return new Promise( async (resolve, reject) => {
      try {
        if (!players.length) reject (new FatalError('No players provided for match'));

        let matchConfigs = deepCopy(this.getConfigs().defaultMatchConfigs);
        
        let match: Match;
        let filesAndNamesAndIDs = players.map((player) => {
          return {file: player.file, tournamentID: player.tournamentID}
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

/**
 * The Tournament module with all tournament related classes, enums, and interfaces
 */
export module Tournament {

  export enum TOURNAMENT_TYPE {
    /** {@link RoundRobinTournament} enum */
    ROUND_ROBIN = 'round_robin', // can be n-tuple round robin. E.g double roundrobin like most Association Football Leagues
    /** {@link EliminationTournament} type */
    ELIMINATION = 'elimination',
    /** {@link LadderTournament} type */
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
    /**
     * The default match configurations to be applied throughout all tournament matches
     */
    defaultMatchConfigs?: DeepPartial<MatchConfigs>
    /**
     * The tournament type to run. See {@link TOURNAMENT_TYPE}
     */
    type: TOURNAMENT_TYPE,
    /**
     * The ranking system to use for this tournament. See {@link RANK_SYSTEM}
     */
    rankSystem: RANK_SYSTEM,

    /**
     * The result handler for returning the appropriate results to the tournament for processing.
     * @params results - the results received from calling the {@link Design.getResults} function
     * 
     * To find what kind of result should be returned, find the Results interface for a tournament. 
     * 
     * Example: For RoundRobin, go to Tournament.RoundRobin.Results
     */
    resultHandler: (results: any) => any

    /**
     * The configurations for a specified rank system. For example, see {@link RANK_SYSTEM.WINS.Configs}, {@link RANK_SYSTEM.TRUESKILL.Configs}
     */
    rankSystemConfigs?: any,

    /**
     * The tournament wide logging level to enforce
     */
    loggingLevel?: Logger.LEVEL

    /**
     * The name of the tournament
     */
    name?: string

    /**
     * Tournament configurations. Dependent on the type of tournament chosen
     */
    tournamentConfigs?: any

    /**
     * An array of valid number of players that can compete in a match. For Rock Paper Scissors for example this would 
     * be [2]
     * @default [2]
     */
    agentsPerMatch: Array<number> // an array of valid players per match

    /**
     * Whether or not to display a continuous console log of the current tournament as it runs
     * @default true
     */
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

  /**
   * Tournament.ID. Represents an identifier for players competing in a {@link Tournament}
   */
  export interface ID {
    /** A string id */
    id: string
    /** A display name */
    name: string
  }
  /**
   * Rank System
   * 
   * An enum for the kind of ranking systems you can choose for a {@link Tournament}
   */
  export enum RANK_SYSTEM {
    /** Ranking by wins, ties and losses */
    WINS = 'wins', 
    /** Ranking by the ELO ranking system */
    ELO = 'elo',
    /** Ranking by Microsoft's Trueskill */
    TRUESKILL = 'trueskill'
  }
  /**
   * @namespace RANK_SYSTEM namespace that contains relevant interfaces for various ranking systems
   */
  export namespace RANK_SYSTEM {
    
    export namespace WINS {
      /**
       * The interface for configuring the {@link RANK_SYSTEM.WINS} format
       */
      export interface Configs {
        /** Points given per win in a {@link Match} */
        winValue: number
        /** Points given per tie in a {@link Match} */
        tieValue: number
        /** Points given per loss in a {@link Match} */
        lossValue: number,
        /** True if first place is the one with the most points. */
        descending: boolean
      }
      /** The results interface that must be returned by a result handler for a {@link Tournament} */
      export interface Results {
        /** Array of agent IDs of {@link agent}s that won in the {@link Match}*/
        winners: Array<agentID>
        /** Array of agent IDs of {@link agent}s that tied in the {@link Match}*/
        ties: Array<agentID>
        /** Array of agent IDs of {@link agent}s that lost in the {@link Match}*/
        losers: Array<agentID>
      }
    }
    export namespace ELO {
      export interface Configs {

      }
      /** The results interface that must be returned by a result handler for a {@link Tournament} */
      export interface Results {
        /** Array of agentIDs and their ranks in a {@link Match}, where rank 1 is highest */
        ranks: Array<{rank: number, agentID: agentID}>
      }
    }

    export namespace TRUESKILL {
      /** The Configuration interface used for configuring the Trueskill ranking system */
      export interface Configs {
        /** The initial Mu value players start with */
        initialMu: number,
        /** The initial sigma value players start with */
        initialSigma: number
      }
      /** The results interface that must be returned by a result handler for a {@link Tournament} */
      export interface Results {
        /** Array of agentIDs and their ranks in a {@link Match}, where rank 1 is highest */
        ranks: Array<{rank: number, agentID: agentID}> 
      }
      export interface RankState {
        /** The current Mu value of a player */
        mu: number,
        /** The current sigma value of a player */
        sigma: number
      }
    }
  }
  /**
   * The RoundRobin Tournament namespace
   */
  export namespace RoundRobin {
    export type Tournament = RoundRobinTournament
    /**
     * Configuration interface for {@link RoundRobinTournament}
     */
    export interface Configs extends Tournament.TournamentTypeConfig {
      /**
       * Number of times each player competes against another player
       * @default 2
       */
      times: number
    }
    /**
     * The {@link RoundRobinTournament} state, consisting of the current player statistics and past results
     */
    export interface State extends Tournament.TournamentTypeState {
      /**
       * A map from a {@link Player} Tournament ID string to statistics
       */
      playerStats: Map<string, {player: Player, wins: number, ties: number, losses: number, matchesPlayed: number}>
      statistics: {
        totalMatches: number
      }
      results: Array<any>
    }
  }
  export namespace Ladder {
    /** Alias for {@link LadderTournament} */
    export type Tournament = LadderTournament
    
    /**
     * Configuration interface for {@link LadderTournament}.
     */
    export interface Configs extends Tournament.TournamentTypeConfig {
      /** Max matches that can run concurrently on one node instance 
       * @default 1
       */
      maxConcurrentMatches: number 
      /** The date to stop running this tournament once it is started. If null, no end date 
       * @default null
       */
      endDate: Date
      /** The max matches to run before stopping the tournament. If null, then no maximum
       * @default null
       */
      maxTotalMatches: number 
    }
    /**
     * The {@link LadderTournament} state, consisting of the current player statistics and past results
     */
    export interface State extends Tournament.TournamentTypeState {
      /**
       * A map from a {@link Player} Tournament ID string to statistics
       */
      playerStats: Map<string, {player: Player, wins: number, ties: number, losses: number, matchesPlayed: number, rankState: any}>
      statistics: {
        totalMatches: number
      }
      currentRanks: Array<{player: Player, rankState: any}>
      results: Array<any>
    }
  }
  
  
}