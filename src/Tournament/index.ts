import { Match } from '../Match';
import { Design } from '../Design';
import { FatalError, TournamentPlayerDoesNotExistError, TournamentError } from '../DimensionError'

import { DeepPartial } from '../utils/DeepPartial';
import { Logger } from '../Logger';

import RankSystemDefault = require('./RankSystem');
import { deepCopy } from '../utils/DeepCopy';
import { Dimension, NanoID } from '../Dimension';
import { genID } from '../utils';
import TournamentStatusDefault = require('./TournamentStatus');
import TournamentTypeDefault = require('./TournamentTypes');

/** @ignore */
import _RankSystem = RankSystemDefault.RankSystem;
/** @ignore */
import _TOURNAMENT_TYPE = TournamentTypeDefault.TournamentType;
/** @ignore */
import _TournamentStatus = TournamentStatusDefault.TournamentStatus;

/**
 * Player class that persists data for the same ephemereal agent across multiple matches
 */
export class Player {
  
  /** 
   * Whether this player is anonymous and not tied to a user on the back end 
   * 
   * If this is ever false, then that means 1. we have a backend setup 2. there is an actual user entry
   */
  public anonymous: boolean = true;

  /**
   * Number of matches this player is involved in at the moment
   */
  public activeMatchCount: number = 0;

  /** Associated username if there is one */
  public username: string = undefined;

  /**
   * Path to player's directory, not the file to be executed/used
   */
  public botDirPath: string = undefined;

  /**
   * Key that references the player's bot file object if it exists
   */
  public botkey: string = undefined;

  /**
   * Whether or not this player is disabled and won't be used in in the default match scheduling for 
   * {@link Tournament.Ladder | Ladder Tournaments}. Is set to true if this player's bot throws an error during 
   * the initialization stage of a {@link Match}.
   */
  public disabled: boolean = false;

  /**
   * Path to the zip file for the bot
   */
  public zipFile: string = undefined;

  constructor(public tournamentID: Tournament.ID, public file: string, zipFile: string, botkey?: string) {
    this.botkey = botkey;
    this.zipFile = zipFile;
  }

  /**
   * Generates a 12 character player id string
   */
  public static generatePlayerID() {
    return genID(12);
  }
}


/**
 * The tournament class and module extended by all concrete Tournament Classes. Tournament Types available now are
 * {@link RoundRobin}, {@link Ladder}, {@link Elimination}. A tournament is composed of players, which can either be 
 * all locally stored, or a split between locally stored anonymous players and database stored user owned players.
 * 
 * Notes: `this.competitors` map is used when no DB is used. When a DB is used, locally stored players are only in
 * `this.anonymousCompetitors` and other players are pulled from DB. Hence, a lot of code requires checking if database
 * exists and if so, pull from there and the anonymous competitors map, other wise use this.state or this.competitors
 */
export abstract class Tournament {

  /** Tournament configs */
  abstract configs: Tournament.TournamentConfigsBase;

  /** Mapping match ids to active ongoing matches */
  public matches: Map<NanoID, Match> = new Map();

  /** A queue whose elements are each arrays of players that are to compete against each other */
  public matchQueue: Array<Array<Player>> = [];
  
  /** The current status of the tournament */
  public status: Tournament.Status = Tournament.Status.UNINITIALIZED;

  /** Ongoing tournament state. Type dependent on Tournament Type chosen */
  abstract state: Tournament.TournamentTypeState;

  /** Logger */
  public log = new Logger();

  /** Registered competitors in this tournament */
  public competitors: Map<NanoID, Player> = new Map();

  /** All competitors that are anonymous competitors and not registered in database */
  public anonymousCompetitors: Map<NanoID, Player> = new Map();

  private playerID = 0;

  /** A reference to the dimension this tournament was spawned from */
  public dimension: Dimension;

  /** This tournament's ID */
  public id: NanoID;

  /**
   * This Tournament's name
   */
  public name = '';

  /**
   * Promise array of which all resolves once every player added through constructor is finished adding
   */
  public initialAddPlayerPromises: Array<Promise<any>> = [];

  constructor(
    protected design: Design,
    files: Array<string> | Array<{file: string, name:string}>, 
    id: NanoID,
    tournamentConfigs: Tournament.TournamentConfigsBase,
    dimension: Dimension
  ) {
    this.id = id;

    // use overriden id if provided
    if (tournamentConfigs.id) {
      this.id = tournamentConfigs.id;
    }

    this.log.level = (tournamentConfigs.loggingLevel !== undefined) ? tournamentConfigs.loggingLevel : Logger.LEVEL.INFO;
    this.name = tournamentConfigs.name ? tournamentConfigs.name : `tournament_${this.id}`;

    
    this.log.identifier = this.name;
    this.dimension = dimension;

    this.log.info(`Created Tournament - ID: ${this.id}, Name: ${this.name}`);
    
    // if no name is provided but database is being used, log an error
    if (!tournamentConfigs.name && dimension.hasDatabase()) {
      this.log.error(`A name has to be specified for a tournament otherwise tournament player data will not be reused across runs of the tournament`)
    }
  }

  /**
   * Add a player to the tournament. Can specify an ID to use. If that ID exists already, this will update the file for 
   * that player instead. First time a player is added (doesn't exist in competitors map yet), if there is existing 
   * stats they won't be reset. Subsequent adds will change the stats.
   * 
   * If the player is to exist beyond the tournament, an existingID must always be provided and generated somewhere else
   * 
   * Resolves with the new player or updated player
   * 
   * @param file - The file to the bot or an object with the file and a name for the player specified
   * @param existingID - The optional id of the player 
   * 
   */
  public async addplayer(file: string | {file: string, name: string, zipFile?: string, botdir?: string, botkey?: string}, existingID?: NanoID): Promise<Player> {
    let id: NanoID;
    if (existingID) {
      let playerStat = await this.getPlayerStat(existingID);
      if (playerStat) {
        // bot has stats in tournament already
        let player = playerStat.player
        let oldname = player.tournamentID.name;
        let oldfile = player.file;
        // remove the oldfile
        if (player.botDirPath) {
          // player.lock();
          removeDirectorySync(player.botDirPath);
          // player.unlock();
        }
        if (typeof file === 'string') {
          player.file = file;
        }
        else {
          player.file = file.file;
          player.tournamentID.name = file.name;
          player.botDirPath = file.botdir;
          player.zipFile = file.zipFile;
          player.botkey = file.botkey;
        }
        // update bot instead and call a tournament's updateBot function
        await this.updatePlayer(player, oldname, oldfile)
        id = existingID;
        return player;
      }
      else {
        // otherwise bot doesn't exist, and we use this id as our id to generate a new player
        id = existingID;
      }


    }
    else {
      id = this.generateNextTournamentIDString();
    }
    
    // add new competitor and call internal add so tournaments can perform any internal operations for the
    // addition of a new player
    if (typeof file === 'string') {
      let name = `player-${id}`;
      let newPlayer = new Player({id: id, name: name}, file, undefined);

      // check database
      if (this.dimension.hasDatabase()) {
        let user = await this.dimension.databasePlugin.getUser(newPlayer.tournamentID.id);
        if (user) {
          newPlayer.anonymous = false;
          newPlayer.username = user.username;
        }
        else {
          this.competitors.set(id, newPlayer);
        }
      }
      else {
        this.competitors.set(id, newPlayer);
      }

      if (newPlayer.anonymous) {
        this.anonymousCompetitors.set(id, newPlayer);
      }
  
      this.internalAddPlayer(newPlayer);
      return newPlayer;
    }
    else {
      let newPlayer = new Player({id: id, name: file.name}, file.file, file.zipFile, file.botkey);
      newPlayer.botDirPath = file.botdir;
      // check database
      if (this.dimension.hasDatabase()) {
        
        let user = await this.dimension.databasePlugin.getUser(newPlayer.tournamentID.id);
        if (user) {
          newPlayer.tournamentID.name = file.name;
          newPlayer.anonymous = false;
          newPlayer.username = user.username;
        }
        else {
          this.competitors.set(id, newPlayer);
        }
      }
      else {
        this.competitors.set(id, newPlayer);
      }
      
      
      if (newPlayer.anonymous) {
        this.anonymousCompetitors.set(id, newPlayer);
      }

      this.internalAddPlayer(newPlayer);
      return newPlayer;
    }
  }

  /**
   * Function to be implemented by a tournament type that performs further tasks to integrate a new player
   * @param player 
   */
  abstract internalAddPlayer(player: Player): void;

  /**
   * Returns a new id for identifying a player in a tournament
   * Only used when adding a plyaer to a tournament is done without specifying an id to use.
   */
  public generateNextTournamentIDString() {
    return Player.generatePlayerID();
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
   * Retrieve some form of rankings from the tournament's current state. The params offset and limit only apply to 
   * {@link Tournament.Ladder | Ladder Tournaments}, used for scaling purposes.
   * 
   * @param offset - the starting ranking to retrieve from
   * @param limit - the number of rankings to retrieve
   */
  public abstract getRankings(offset?: number, limit?: number): any;

  /**
   * Update function that is called whenever an existing player is updated
   * @param player - the {@link Player} that was updated
   * @param oldname - the previous name for the player
   * @param oldfile - the previous file for the player
   */
  abstract async updatePlayer(player: Player, oldname: string, oldfile: string): Promise<void>;

  /**
   * Removes the competitor/player with id `playerID` (a {@link nanoid}). Resolves if succesful, otherwise rejects if
   * player doesn't exist or couldn't be removed
   * 
   * @param playerID - ID of the player to remove
   */
  public async removePlayer(playerID: nanoid) {
    let playerStat = this.getPlayerStat(playerID);
    if (playerStat) {
      this.competitors.delete(playerID);
      this.anonymousCompetitors.delete(playerID);
      await this.internalRemovePlayer(playerID);
    }
    else {
      throw new TournamentPlayerDoesNotExistError('Not a player');
    }
  }

  protected async internalRemovePlayer(playerID: nanoid) {

  }

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
  protected async runMatch(players: Array<Player>): Promise<{results: any, match: Match, err?: any}> {
    if (!players.length) throw new FatalError('No players provided for match');

    let matchConfigs = deepCopy(this.getConfigs().defaultMatchConfigs);
    
    let match: Match;
    let filesAndNamesAndIDs: Array<{file: string, tournamentID: Tournament.ID, botkey?: string}> 
      = players.map((player) => {
      // if player has a botkey, use that, otherwise use whats in player.file
      return {file: player.file, tournamentID: player.tournamentID, botkey: player.botkey}
    });
    match = new Match(this.design, filesAndNamesAndIDs, matchConfigs, this.dimension);

    // store match into the tournament locally
    this.matches.set(match.id, match);

    // Initialize match with initialization configuration
    try {
      await match.initialize();

      // Get results
      let results = await match.run();

      // if database plugin is active and saveTournamentMatches is set to true, store match
      if (this.dimension.hasDatabase()) {
        if (this.dimension.databasePlugin.configs.saveTournamentMatches) {
          this.dimension.databasePlugin.storeMatch(match, this.id);
        }
      }

      // remove the match from the active matches list
      this.matches.delete(match.id);
      // TODO: Add option to just archive matches instead
      
      // Resolve the results
      return {results: results, match: match};
    }
    catch(err) {
      return {
        results: false,
        err: err,
        match: match
      }
    }
  }

  /**
   * Removes a match by id. Returns true if deleted, false if nothing was deleted
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
   * Destroy this tournament. Rejects if an error occured in trying to destroy it.
   */
  public async destroy(): Promise<void> {
    await this.preInternalDestroy();
    
    // stop if running
    if (this.status === Tournament.Status.RUNNING) this.stop();
    
    let destroyPromises = [];
    
    // now remove all match processes
    this.matches.forEach((match) => {
      destroyPromises.push(match.destroy());
    });
    await Promise.all(destroyPromises);
    await this.postInternalDestroy();
  }

  /**
   * Pre run function before generic destroy takes place
   */
  protected async preInternalDestroy() {

  }

  /**
   * Post run function before generic destroy takes place
   */
  protected async postInternalDestroy() {

  }

  /**
   * Generates a 6 character tournament ID identifying this tournament class instance. Not to be confused with
   * {@link Tournament.ID} which is the ID for competitors in the tournament
   */
  public static genTournamentClassID() {
    return genID(6);
  }

  /**
   * Returns the name of the tournament but formatted (no spaces)
   */
  public getSafeName() {
    return this.name.replace(/ /g, '_');
  }

  /**
   * Returns a key name to be used when storing a tournament by a combination of its name and id
   */
  public getKeyName() {
    return `${this.getSafeName()}_${this.id}`;
  }

  /**
   * Resolves with player stats if player with the id exists. otherwise resolves with null
   * @param id - id of player to get
   */
  public async getPlayerStat(id: nanoid): Promise<Tournament.PlayerStatBase> {
    if (!this.competitors.has(id)) {
      if (this.dimension.hasDatabase()) {
        let user = await this.dimension.databasePlugin.getUser(id);
        if (user && user.statistics[this.getKeyName()]) {
          return user.statistics[this.getKeyName()];
        }
      }
    }
    else {
      return this.state.playerStats.get(id);
    }
    return null;
  }

}

// some imports moved to here to avoid circular issues with using values
import LadderDefault = require('./Ladder');
/** @ignore */
import LadderTournament = LadderDefault.Ladder;
import RoundRobinDefault = require('./RoundRobin');
/** @ignore */
import RoundRobinTournament = RoundRobinDefault.RoundRobin;
import EliminationDefault = require('./Elimination');
/** @ignore */
import EliminationTournament = EliminationDefault.Elimination;
import { nanoid } from '..';
import { removeDirectory, removeDirectorySync } from '../utils/System';

export module Tournament {

  // Re-export some types
  export import Type = _TOURNAMENT_TYPE;
  export import Status = _TournamentStatus;
  export import RankSystem = _RankSystem;

  /**
   * @deprecated since v2.1.0
   * 
   * Use {@link Tournament.RankSystem} instead
   */
  export import RANK_SYSTEM = _RankSystem;

  /**
   * @deprecated since v2.1.0 
   * 
   * Use {@link Tournament.Type} instead.
   */
  export import TOURNAMENT_TYPE = _TOURNAMENT_TYPE;

  /**
   * @deprecated since v2.1.0 
   * 
   * Use {@link Tournament.Status} instead.
   */
  export import TournamentStatus = _TournamentStatus;

  /**
   * Required and Optional Tournament configurations
   */
  export interface TournamentConfigsBase {
    /**
     * The default match configurations to be applied throughout all tournament matches
     */
    defaultMatchConfigs?: DeepPartial<Match.Configs>
    /**
     * The tournament type to run. See {@link Tournament.Type}
     */
    type: Type,
    /**
     * The ranking system to use for this tournament
     */
    rankSystem: RankSystem,

    /**
     * The result handler for returning the appropriate results to the tournament for processing.
     * 
     * To find what kind of result should be returned, find the Results interface for the rank system you are using. 
     * 
     * Example: For {@link Tournament.RankSystem.TRUESKILL}, go to {@link Tournament.RankSystem.TRUESKILL.Results}
     */
    resultHandler: 
    /**
     * @param results - the results received from calling the {@link Design.getResults} function
     */
    (results: any) => any

    /**
     * The configurations for a specified rank system. For example, see {@link RankSystem.WINS.Configs}, 
     * {@link RankSystem.TRUESKILL.Configs}
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
     * Example: For {@link RoundRobin}, go to {@link RoundRobin.Configs}
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
     * @default `true`
     */
    consoleDisplay?: boolean

    /**
     * Set this ID to override the generated ID 
     */
    id?: string

  }

  /**
   * Queued match information, consisting of player IDs of players to compete
   */
  export type QueuedMatchInfo = Array<nanoid>

  /**
   * Internally used type.
   */
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

    /**
     * Past results stored. Each element is what is returned by {@link Design.getResults}
     */
    results: Array<any>

    /**
     * Map from player ID to player stats
     */
    playerStats: Map<NanoID, PlayerStatBase>
  }

  /**
   * Tournament.ID. Represents an identifier for players competing in a {@link Tournament}
   */
  export interface ID {
    /** A string id. This should never change */
    readonly id: NanoID
    /** A display name */
    name: string
  }

  export interface PlayerStatBase {
    player: Player,
    matchesPlayed: number
  }

  // Re-export tournament classes/namespaces
  export import Ladder = LadderTournament; 
  export import RoundRobin = RoundRobinTournament;
  export import Elimination = EliminationTournament;
}


