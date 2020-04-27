import { Match } from '../Match';
import { Design } from '../Design';
import { FatalError } from '../DimensionError';
import { RoundRobinTournament } from './TournamentTypes/RoundRobin';
import { EliminationTournament } from './TournamentTypes/Elimination';
import { DeepPartial } from '../utils/DeepPartial';
import { Logger } from '../Logger';
import { LadderTournament } from './TournamentTypes/Ladder';
import { Agent } from '../Agent';
import { deepCopy } from '../utils/DeepCopy';
import { Rating } from 'ts-trueskill';
import { ELORating } from './ELO';

/**
 * Player class that persists data for the same ephemereal agent across multiple matches
 */
export class Player {
  constructor(public tournamentID: Tournament.ID, public file: string) {

  }
}


/**
 * @class Tournament
 * @classdesc The tournament class extended by all concrete Tournament Classes. Tournament Types available now are
 * {@link RoundRobin.Tournament}, {@link Ladder.Tournament}, {@link Elimination.Tournament}
 */
export abstract class Tournament {

  /** Tournament configs */
  abstract configs: Tournament.TournamentConfigsBase;

  /** Mapping match ids to active ongoing matches */
  public matches: Map<number, Match> = new Map();

  /** A queue whose elements are each arrays of player that are to compete against each other */
  public matchQueue: Array<Array<Player>> = [];
  
  /** The current status of the tournament */
  public status: Tournament.TournamentStatus = Tournament.TournamentStatus.UNINITIALIZED;

  /** Ongoing tournament state. Type dependent on Tournament Type chosen */
  abstract state: unknown;

  /** Logger */
  public log = new Logger();

  /** Registered competitors in this tournament */
  public competitors: Array<Player> = [];

  private playerID = 0;

  /**
   * This Tournament's name
   */
  public name = '';

  constructor(
    protected design: Design,
    files: Array<string> | Array<{file: string, name:string}>, 
    public id: number,
    tournamentConfigs: Tournament.TournamentConfigsBase
  ) {
    this.log.level = (tournamentConfigs.loggingLevel !== undefined) ? tournamentConfigs.loggingLevel : Logger.LEVEL.INFO;
    this.name = tournamentConfigs.name ? tournamentConfigs.name : `tournament_${this.id}`;
    this.log.identifier = this.name;
  }

  /**
   * Add a player to the tournament. Can specify an ID to use. If that ID exists already, this will update the file for 
   * that player instead 
   * @param file - The file to the bot or an object with the file and a name for the player specified
   */
  public addplayer(file: string | {file: string, name: string}, existingID?: string) {
    let id: string;
    if (existingID) {
      let content = existingID.split('_');
      let existingPlayerID = parseInt(content[1]);
      if (existingPlayerID < this.competitors.length) {
        // bot exists already
        let player = this.competitors[existingPlayerID];
        let oldname = player.tournamentID.name;
        let oldfile = player.file;
        if (typeof file === 'string') {
          player.file = file;
        }
        else {
          player.file = file.file;
          player.tournamentID.name = file.name;
        }
        // update bot instead and call a tournament's updateBot function
        this.updatePlayer(player, oldname, oldfile)
        id = existingID;
        return;
      }
      else {
        id = existingID;
      }
    }
    else {
      id = this.generateNextTournamentIDString();
    }
    
    // push new competitor and call internal add so tournaments can internall sort out the addition of a new player
    if (typeof file === 'string') {
      let name = `player-${id}`;
      let newPlayer = new Player({id: id, name: name}, file);
      this.competitors.push(newPlayer);
      this.internalAddPlayer(newPlayer);
    }
    else {
      let newPlayer = new Player({id: id, name: file.name}, file.file);
      this.competitors.push(newPlayer);
      this.internalAddPlayer(newPlayer);
    }
  }

  abstract internalAddPlayer(player: Player): void;

  /**
   * Returns a new and unique id
   */
  public generateNextTournamentIDString() {
    return `t${this.id}_${this.playerID++}`;
  }

  /**
   * Returns true if the id given is associated to this tournament and valid for use
   */
  public validateTournamentID(id: string) {
    let content = id.split('_');
    if (content.length !== 2) {
      return false;
    }
    let playerID = content[1];
    if (isNaN(parseInt(playerID))) {
      return false;
    }
    if (content[0][0] !== 't') {
      return false;
    }
    let tourneyID = content[0].slice(1);
    if (isNaN(parseInt(tourneyID)) || parseInt(tourneyID) !== this.id) {
      return false;
    }
    return true;
  }
  /**
   * Start the tournament
   * @param configs - the configs to use for the tournament
   */
  public abstract async run(configs?: DeepPartial<Tournament.TournamentConfigsBase>): Promise<any>;

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
  public abstract getRankings(): any;

  /**
   * Update function that is called whenever an existing player is updated
   * @param player - the {@link Player} that was updated
   * @param oldname - the previous name for the player
   * @param oldfile - the previous file for the player
   */
  abstract updatePlayer(player: Player, oldname: string, oldfile: string): void;


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
   * Runs a match
   * @param players - the players to compete together
   * @returns a promise that resolves with the results and the associated match
   */
  protected async runMatch(players: Array<Player>): Promise<{results: any, match: Match}> {
    if (!players.length) throw new FatalError('No players provided for match');

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
    return {results: results, match: match};
  }
}

/**
 * The Tournament module with all tournament related classes, enums, and interfaces
 */
export module Tournament {

  export enum TOURNAMENT_TYPE {
    /** {@link RoundRobinTournament} type */
    ROUND_ROBIN = 'round_robin',
    /** {@link EliminationTournament} type */
    ELIMINATION = 'elimination',
    /** {@link LadderTournament} type */
    LADDER = 'ladder', // like halite
  }
  export enum TournamentStatus {
    /** Status when tournament was just called with new */
    UNINITIALIZED = 'uninitialized',
    /** Tournmanet is ready to run with {@link Tournament.run} */
    INITIALIZED = 'initialized',
    /** Tournmanet is currently stopped */
    STOPPED = 'stopped',
    /** Tournmanet is running */
    RUNNING = 'running',
    /** Tournmanet crashed some how */
    CRASHED = 'crashed',
  }

  /**
   * Required and Optional Tournament configurations
   */
  export interface TournamentConfigsBase {
    /**
     * The default match configurations to be applied throughout all tournament matches
     */
    defaultMatchConfigs?: DeepPartial<Match.Configs>
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
     * 
     * To find what kind of result should be returned, find the Results interface for the rank system you are using. 
     * 
     * Example: For {@link RANK_SYSTEM.TRUESKILL}, go to {@link RANK_SYSTEM.TRUESKILL.Results}
     */
    resultHandler: 
    /**
     * @param results - the results received from calling the {@link Design.getResults} function
     */
    (results: any) => any

    /**
     * The configurations for a specified rank system. For example, see {@link RANK_SYSTEM.WINS.Configs}, 
     * {@link RANK_SYSTEM.TRUESKILL.Configs}
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
     * Example: For {@link RoundRobin.Tournament}, go to {@link RoundRobin.Configs}
     */
    tournamentConfigs?: any

    /**
     * An array of valid number of players that can compete in a match. For Rock Paper Scissors for example this would 
     * be [2]
     * @default `[2]`
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
    /**
     * Whether or not to store past results using the specified option of the dimension (database or in memory)
     * @default `true`
     */
    storePastResults: boolean
  }
  export interface TournamentTypeState  {
    
  }

  /**
   * Tournament.ID. Represents an identifier for players competing in a {@link Tournament}
   */
  export interface ID {
    /** A string id. This should never change */
    readonly id: string
    /** A display name */
    name: string
  }
  /**
   * Rank System enums for the kind of ranking systems you can choose for a {@link Tournament}
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
    
    /**
     * Wins rank system. Ranks based on Wins, Ties, and Losses.
     */
    export namespace WINS {
      /**
       * The configuration interface for configuring the {@link WINS} ranking system
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
        winners: Array<Agent.ID>
        /** Array of agent IDs of {@link agent}s that tied in the {@link Match}*/
        ties: Array<Agent.ID>
        /** Array of agent IDs of {@link agent}s that lost in the {@link Match}*/
        losers: Array<Agent.ID>
      }
    }
    /**
     * ELO Rank system
     */
    export namespace ELO {

      /**
       * The configuration interface for configuring the {@link ELO} ranking system
       */
      export interface Configs {
        /** 
         * Starting ELO score 
         * @default `1000`
         */
        startingScore: number,
        /** 
         * The k factor to use for the ranking.
         * @default `32`
         */
        kFactor: number,
      }
      /** The results interface that must be returned by a result handler for a {@link Tournament} */
      export interface Results {
        /** 
         * Array of {@link Agent.ID}s and their ranks in a {@link Match}, 
         * An agent scores a 1 against another agent if their rank is higher. 0.5 if the same, and 0 if lower
         * Same interface as {@link TRUESKILL.Results} and result handlers can be used interchangeably
         */
        ranks: Array<{rank: number, agentID: Agent.ID}>
      }

      /** The current rank state of a player */
      export interface RankState {
        /** The ELO Rating */
        rating: ELORating,
        toJSON?: Function
      }
    }

    export namespace TRUESKILL {
      /** The Configuration interface used for configuring the {@link TRUESKILL} ranking system */
      export interface Configs {
        /** 
         * The initial Mu value players start with 
         * @default `25`
         */
        initialMu: number,
        /** 
         * The initial sigma value players start with 
         * @default `25/3`
         */
        initialSigma: number
      }
      /** The results interface that must be returned by a result handler for a {@link Tournament} */
      export interface Results {
        /** Array of agentIDs and their ranks in a {@link Match}, where rank 1 is highest */
        ranks: Array<{rank: number, agentID: Agent.ID}> 
      }
      /** The current rank state of a player */
      export interface RankState { 
        /** The trueskill rating */
        rating: Rating,
        /** Function to return some internal data of rating when using API */
        toJSON?: Function
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
       * @default `2`
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
      /**
       * Stats for this Tournament
       */
      statistics: {
        totalMatches: number
      }
      /**
       * Past results stored. Each element is what is returned by {@link Design.getResults}
       */
      results: Array<any>
    }
  }
  /**
   * The Ladder Tournament namespace
   */
  export namespace Ladder {
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
      /**
       * Stats for this Tournament
       */
      statistics: {
        totalMatches: number
      }
      currentRanks: Array<{player: Player, rankState: any}>
      /**
       * Past results stored. Each element is what is returned by {@link Design.getResults}
       */
      results: Array<any>
    }
  }
  
  /**
   * The Elimination Tournament namespace
   */
  export namespace Elimination {
    export type Tournament = EliminationTournament
    /**
     * Configuration interface for {@link EliminationTournament}
     */
    export interface Configs extends Tournament.TournamentTypeConfig {
      /**
       * Number of times the elimination tournament runs
       * @default `2`
       */
      times: number,
      /**
       * Number of times a player can lose before being eliminated. Can be 1 for single elimination. 2 for double 
       * elimination is not implemented yet
       * @default `1`
       */
      lives: 1,

      /**
       * The seeding of the competitors in the order they are loaded. 
       * When set to null, no seeds are used. When the ith array element is null, the ith competitor loaded, which has * tournament ID of i, does not have a seed.
       * @default `null`
       */
      seeding: Array<number>
    }
    /**
     * The {@link EliminationTournament} state, consisting of the current player statistics and past results
     */
    export interface State extends Tournament.TournamentTypeState {
      /**
       * A map from a {@link Player} Tournament ID string to statistics
       */
      playerStats: Map<string, {player: Player, wins: number, losses: number, matchesPlayed: number, seed: number, rank: number}>
      /**
       * Stats for this Tournament
       */
      statistics: {
        totalMatches: number
      }

      currentRound: number
      /**
       * Past results stored. Each element is what is returned by {@link Design.getResults}
       */
      results: Array<any>

      /**
       * A match hash in the tournament indicating what seeds are meant to compete against each other.
       * This maps a match hash to the result at the part of the tournament, indicating who won and lost
       */
      resultsMap: Map<string, {winner: Player, loser: Player}>
    }
  }
  
}