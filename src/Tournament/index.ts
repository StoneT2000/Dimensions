import { EventEmitter } from 'events';
import { Agent } from '../Agent';
import { Match } from '../Match';
import { Design } from '../Design';
import {
  FatalError,
  TournamentPlayerDoesNotExistError,
  DatabaseGetUserError,
} from '../DimensionError';

import { DeepPartial } from '../utils/DeepPartial';
import { Logger } from '../Logger';

import { RankSystem as _RankSystem } from './RankSystem';
import { deepCopy } from '../utils/DeepCopy';
import { Dimension, NanoID } from '../Dimension';
import { genID } from '../utils';
import { nanoid } from '..';
import { removeDirectorySync } from '../utils/System';
import { Database } from '../Plugin/Database';

import VarLock from '../utils/VarLock';
import { TournamentStatus as _TournamentStatus } from './TournamentStatus';
import { TournamentType as _TOURNAMENT_TYPE } from './TournamentTypes';
// import TournamentStatusDefault = require('./TournamentStatus');
// import TournamentTypeDefault = require('./TournamentTypes');

/** @ignore */
// import _RankSystem = RankSystemDefault.RankSystem;
/** @ignore */
// import _TOURNAMENT_TYPE = TournamentTypeDefault.TournamentType;
/** @ignore */
// import _TournamentStatus = TournamentStatusDefault.TournamentStatus;

/**
 * Player class that persists data for the same ephemereal agent across multiple matches. Used for {@link Tournament | Tournaments}
 */
export class Player {
  /**
   * Whether this player is anonymous and not tied to a user on the back end
   *
   * If this is ever false, then that means 1. we have a backend setup 2. there is an actual user entry
   */
  public anonymous = true;

  /** Associated username if there is one */
  public username: string = undefined;

  /**
   * Path to player's directory, not the file to be executed/used. Value is necessary if storage system is not used or
   * there is no bot key because the player is anonymous (locally stored). Used so tournament can clean up old bot
   * directory when a new bot is uploaded
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
  public disabled = false;

  /**
   * Path to the zip file for the bot. Used when no storage service is used. Used to allow api to send zipped bot file
   */
  public zipFile: string = undefined;

  /**
   * The version of the bot associated with this player. Incremented whenever addPlayer is called
   */
  public version = 0;

  constructor(
    public tournamentID: Tournament.ID,
    public file: string,
    zipFile: string,
    botkey?: string
  ) {
    this.botkey = botkey;
    this.zipFile = zipFile;
  }

  /**
   * Generates a 12 character player id string
   */
  public static generatePlayerID(): string {
    return genID(12);
  }
}

/**
 * The tournament class and module extended by all concrete Tournament Classes. Tournament Types available now are
 * {@link Ladder}, and {@link Elimination}. A tournament is composed of players, which can either be
 * all locally stored, or a split between locally stored anonymous players and database stored user owned players.
 * Ladder is the only tournament where it can be made distributed, other tournament types may only be run as a single
 * instance
 *
 * Notes: `this.competitors` map is used when no DB is used. When a DB is used, locally stored players are only in
 * `this.anonymousCompetitors` and other players are pulled from DB. Hence, a lot of code requires checking if database
 * exists and if so, pull from there and the anonymous competitors map, other wise use this.state or this.competitors
 */
export abstract class Tournament extends EventEmitter {
  /** Tournament configs */
  abstract configs: Tournament.TournamentConfigsBase;

  /** Mapping match ids to active ongoing matches */
  public matches: Map<NanoID, Match> = new Map();

  /** A queue whose elements are each arrays of players that are to compete against each other */
  public matchQueue: Array<Tournament.QueuedMatch> = [];

  /** The current status of the tournament */
  public status: Tournament.Status = Tournament.Status.UNINITIALIZED;

  /** Ongoing tournament state. Type dependent on Tournament Type chosen */
  abstract state: Tournament.TournamentTypeState;

  /** Logger */
  public log = new Logger();

  /** Registered competitors in this tournament */
  public competitors: Map<NanoID, Player> = new Map();

  /**
   * All competitors that are anonymous, local (no user), competitors and not registered in database. Used only when
   * there is a DB
   */
  public anonymousCompetitors: Map<NanoID, Player> = new Map();

  /** A reference to the dimension this tournament was spawned from */
  public dimension: Dimension;

  /** This tournament's ID */
  public id: NanoID;

  /**
   * This Tournament's name
   */
  public name = '';

  /** Tournament Type */
  abstract type: Tournament.Type;

  /**
   * Promise array of which all resolves once every player added through constructor is finished adding
   */
  public initialAddPlayerPromises: Array<Promise<any>> = [];

  /**
   * Map from player ids to a promise that resolves once it is unlocked from the function that initiated a promise
   */
  private lockedPlayers: Map<nanoid, VarLock> = new Map();

  /**
   * Map from player ids to the last version used in a match
   *
   * TODO: This is not a good solution, it is effectively an in-memory cache used to invalidate past bot files. It has
   * low space overhead but it won't scale nicely.
   */
  private lastVersionUsed: Map<nanoid, number> = new Map();

  constructor(
    protected design: Design,
    id: NanoID,
    tournamentConfigs: Tournament.TournamentConfigsBase,
    dimension: Dimension
  ) {
    super();
    this.id = id;

    // use overriden id if provided
    if (tournamentConfigs.id) {
      this.id = tournamentConfigs.id;
    }

    this.log.level =
      tournamentConfigs.loggingLevel !== undefined
        ? tournamentConfigs.loggingLevel
        : Logger.LEVEL.INFO;
    this.name = tournamentConfigs.name
      ? tournamentConfigs.name
      : `tournament_${this.id}`;

    this.log.identifier = this.name;
    this.dimension = dimension;

    this.log.info(`Created Tournament - ID: ${this.id}, Name: ${this.name}`);

    // if no name is provided but database is being used, log an error
    if (!tournamentConfigs.name && dimension.hasDatabase()) {
      this.log.error(
        `A name has to be specified for a tournament otherwise tournament player data will not be reused across runs of the tournament`
      );
    }
  }

  /**
   * Add or update a player to the tournament
   *
   * If no existing ID is specified, this is treated as adding a completely new player.
   *
   * If existing ID is specified and that ID exists already, this will update the file for that player instead and
   * effectively update the player. First time a player is added, if there is existing stats in a DB they won't be
   * reset. Subsequent adds will change the stats.
   *
   * If the player is to exist beyond the tournament, an existingID must always be provided and generated somewhere else
   *
   * Resolves with the new player or updated player
   *
   * @param file - The file to the bot or an object with the file and a name for the player specified
   * @param existingID - The optional id of the player. Can also be provided in the first arg in a object
   * @param calledFromInitialization - Whether or not the player was called from initialization. If true, player
   * version does not increment
   *
   */
  public async addplayer(
    file:
      | string
      | {
          file: string;
          name: string;
          zipFile?: string;
          botdir?: string;
          botkey?: string;
          existingID?: NanoID;
        },
    existingID?: NanoID,
    calledFromInitialization = false
  ): Promise<Player> {
    let id: NanoID;

    if (typeof file !== 'string') {
      if (!existingID) {
        existingID = file.existingID;
      }
    }

    if (existingID) {
      const { playerStat } = await this.getPlayerStat(existingID);
      if (playerStat) {
        // we need a lock since we are updating
        let varlock = this.lockedPlayers.get(existingID);
        if (varlock) {
          await varlock.lockvar();
        } else {
          varlock = new VarLock();
          this.lockedPlayers.set(existingID, varlock);
        }
        // bot has stats in tournament already
        const player = playerStat.player;
        // undisable the player
        player.disabled = false;

        const oldname = player.tournamentID.name;
        const oldfile = player.file;
        // remove the oldfile
        if (player.botDirPath) {
          removeDirectorySync(player.botDirPath);
        }
        if (typeof file === 'string') {
          player.file = file;
        } else {
          player.file = file.file;
          player.tournamentID.name = file.name;
          player.botDirPath = file.botdir;
          player.zipFile = file.zipFile;
          player.botkey = file.botkey;
          if (!calledFromInitialization) {
            // update version and last update time stamp
            player.version++;
          }
        }
        // update bot instead and call a tournament's updateBot function
        try {
          await this.updatePlayer(player, oldname, oldfile);
          varlock.unlock();
          this.lockedPlayers.delete(existingID);
        } catch (err) {
          varlock.unlockWithError(err);
          this.lockedPlayers.delete(existingID);
          throw err;
        }
        id = existingID;
        return player;
      } else {
        // otherwise bot doesn't exist locally or in db row statistics field, and we use this id as our id to generate a new player
        id = existingID;
      }
    } else {
      id = this.generateNextTournamentIDString();
    }

    // at this stage, we are now adding a new competitor and call internal add so tournaments can perform any internal /// operations for the addition of a new player
    if (typeof file === 'string') {
      const name = `player-${id}`;
      const newPlayer = new Player(
        { id: id, name: name, username: undefined },
        file,
        undefined
      );

      // check database
      if (this.dimension.hasDatabase()) {
        const user = await this.dimension.databasePlugin.getUser(
          newPlayer.tournamentID.id
        );
        if (user) {
          newPlayer.anonymous = false;
          newPlayer.username = user.username;
          newPlayer.tournamentID.username = user.username;
        } else {
          this.competitors.set(id, newPlayer);
        }
      } else {
        this.competitors.set(id, newPlayer);
      }

      if (newPlayer.anonymous) {
        this.anonymousCompetitors.set(id, newPlayer);
      }

      await this.internalAddPlayer(newPlayer);
      return newPlayer;
    } else {
      const newPlayer = new Player(
        { id: id, name: file.name, username: undefined },
        file.file,
        file.zipFile,
        file.botkey
      );
      newPlayer.botDirPath = file.botdir;
      // check database
      if (this.dimension.hasDatabase()) {
        const user = await this.dimension.databasePlugin.getUser(
          newPlayer.tournamentID.id
        );
        if (user) {
          newPlayer.tournamentID.name = file.name;
          newPlayer.anonymous = false;
          newPlayer.username = user.username;
          newPlayer.tournamentID.username = user.username;
        } else {
          this.competitors.set(id, newPlayer);
        }
      } else {
        this.competitors.set(id, newPlayer);
      }

      if (newPlayer.anonymous) {
        this.anonymousCompetitors.set(id, newPlayer);
      }

      await this.internalAddPlayer(newPlayer);
      return newPlayer;
    }
  }

  /**
   * Function to be implemented by a tournament type that performs further tasks to integrate a new player
   * @param player
   */
  abstract async internalAddPlayer(player: Player): Promise<void>;

  /**
   * Returns a new id for identifying a player in a tournament
   * Only used when adding a plyaer to a tournament is done without specifying an id to use.
   */
  public generateNextTournamentIDString(): string {
    return Player.generatePlayerID();
  }

  /**
   * Start the tournament
   * @param configs - the configs to use for the tournament
   * @param master - whether or not the instance calling stop was the first one, the "master" instance. Used only in
   * distributed scenarios
   */
  public abstract async run(
    configs?: DeepPartial<Tournament.TournamentConfigsBase>,
    master?: boolean
  ): Promise<any>;

  /**
   * Stops the tournament while running
   * @param master - whether or not the instance calling stop was the first one, the "master" instance. Used only in
   * distributed scenarios
   */
  public abstract async stop(master?: boolean): Promise<any>;

  /**
   * Resumes the tournament
   * @param master - whether or not the instance calling stop was the first one, the "master" instance. Used only in
   * distributed scenarios
   */
  public abstract async resume(master?: boolean): Promise<any>;

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
  abstract async updatePlayer(
    player: Player,
    oldname: string,
    oldfile: string
  ): Promise<void>;

  /**
   * Disables the player with id playerID
   * @param playerID - the player's id to disable
   */
  public async disablePlayer(playerID: nanoid): Promise<void> {
    const { user, playerStat } = await this.getPlayerStat(playerID);
    if (playerStat) {
      playerStat.player.disabled = true;
      if (this.dimension.hasDatabase() && user) {
        await this.dimension.databasePlugin.updateUser(playerID, user);
      }
    } else {
      throw new TournamentPlayerDoesNotExistError(
        `Player ${playerID} was not found in this tournament`
      );
    }
  }

  /**
   * Removes the competitor/player with id `playerID` (a {@link nanoid}). Resolves if succesful, otherwise rejects if
   * player doesn't exist or couldn't be removed
   *
   * @param playerID - ID of the player to remove
   */
  public async removePlayer(playerID: nanoid): Promise<void> {
    const { user, playerStat } = await this.getPlayerStat(playerID);
    if (playerStat) {
      this.competitors.delete(playerID);
      this.anonymousCompetitors.delete(playerID);
      // disable player
      playerStat.player.disabled = true;
      if (this.dimension.hasDatabase() && user) {
        await this.dimension.databasePlugin.updateUser(playerID, user);
      }
      await this.internalRemovePlayer(playerID);
    } else {
      throw new TournamentPlayerDoesNotExistError('Not a player');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  protected async internalRemovePlayer(playerID: nanoid): Promise<void> {}

  /**
   * Set configs for this tournament
   * @param configs the configs to deep merge with the current configs
   */
  abstract setConfigs(
    configs: DeepPartial<Tournament.TournamentConfigsBase>
  ): void;

  /**
   * Set configs for this tournament
   * @param configs the configs to deep merge with the current configs
   */
  abstract getConfigs(): Tournament.TournamentConfigsBase;

  /**
   * Runs a match
   * @param players - the players to compete together
   * @returns a promise that resolves with the results and the associated match
   */
  protected async runMatch(
    players: Array<Player>
  ): Promise<{
    results: any;
    match: Match;
    err?: any;
  }> {
    if (!players.length) throw new FatalError('No players provided for match');

    // get all player locks for use later
    const locks: Array<Promise<void>> = [];
    players.forEach((player) => {
      if (this.lockedPlayers.has(player.tournamentID.id)) {
        locks.push(this.lockedPlayers.get(player.tournamentID.id).lock);
      }
    });
    // use default match configs given to this tournament
    const matchConfigs = deepCopy(this.getConfigs().defaultMatchConfigs);

    // enable caching for bots that have not been updated
    const agentSpecificOptions: Array<DeepPartial<Agent.Options>> = [];
    for (const player of players) {
      // TODO: move all promises to an array and do Promise.all
      const lv = await this.getLastVersionUsedOfPlayer(player.tournamentID.id);
      if (lv !== undefined && lv === player.version) {
        this.log.system(
          `player ${player.tournamentID.id} attempting to use cached bot`
        );
        agentSpecificOptions.push({
          useCachedBotFile: true,
        });
      } else {
        this.log.system(
          `player ${player.tournamentID.id} not using cached bot file`
        );
        agentSpecificOptions.push({
          useCachedBotFile: false,
        });
      }
    }
    matchConfigs.agentSpecificOptions = agentSpecificOptions;

    const filesAndNamesAndIDs: Agent.GenerationMetaData_Tournament = players.map(
      (player) => {
        // if player has a botkey, use that, otherwise use whats in player.file
        return {
          file: player.file,
          tournamentID: player.tournamentID,
          botkey: player.botkey,
          version: player.version,
        };
      }
    );
    const match = new Match(
      this.design,
      filesAndNamesAndIDs,
      matchConfigs,
      this.dimension
    );

    // store match into the tournament locally
    this.matches.set(match.id, match);

    try {
      /**
       * using "mutex" locks to force any update to players to happen completely before or after match initialization,
       * helping eliminate race conditions
       */

      // wait for all locks to release
      await Promise.all(locks);
      // now lock all players. We lock them so that we can correctly determine whether to use caching or not before an
      // update occurs
      for (let i = 0; i < players.length; i++) {
        const varlock = this.lockedPlayers.get(players[i].tournamentID.id);
        if (varlock) {
          await varlock.lockvar();
        } else {
          this.lockedPlayers.set(players[i].tournamentID.id, new VarLock());
        }
      }
      await match.initialize().finally(() => {
        // release all locks once this is done
        for (let i = 0; i < players.length; i++) {
          const varlock = this.lockedPlayers.get(players[i].tournamentID.id);
          if (varlock) {
            varlock.unlock();
            // delete the varlock
            this.lockedPlayers.delete(players[i].tournamentID.id);
          }
        }
      });

      // note: method to test locks, match.initialize(); do a await sleep(5000); and try updating bot during initialization. If response takes a few seconds to respond, then locks worked as update happenedd after initialization.

      players.forEach(async (player) => {
        await this.updateLastVersionUsedOfPlayer(
          player.tournamentID.id,
          player.version
        );
      });

      // Get results
      const results = await match.run();

      // remove the match from the active matches list
      this.matches.delete(match.id);

      // Resolve the results
      return { results, match };
    } catch (err) {
      this.emit(Tournament.Events.MATCH_RAN);
      return {
        results: false,
        err,
        match,
      };
    } finally {
      // regardless of error or not ensure match is stored
      // if database plugin is active and saveTournamentMatches is set to true, store match
      if (this.dimension.hasDatabase()) {
        if (this.dimension.databasePlugin.configs.saveTournamentMatches) {
          this.dimension.databasePlugin.storeMatch(match, this.id);
        }
      }
    }
  }

  /**
   * Return an Array of Players corresponding to the player ids stored in `queuedMatchInfo`
   * @param queuedMatchInfo
   */
  public async getMatchInfoFromQueuedMatch(
    queuedMatchInfo: Tournament.QueuedMatch
  ): Promise<Array<Player>> {
    // Consider adding possibility to use cached player meta data to reduce db reads
    const retrievePlayerPromises: Array<Promise<Player>> = [];
    for (let i = 0; i < queuedMatchInfo.length; i++) {
      const playerId = queuedMatchInfo[i];

      retrievePlayerPromises.push(
        this.getPlayerStat(playerId).then(({ playerStat }) => playerStat.player)
      );
    }

    return await Promise.all(retrievePlayerPromises);
  }

  public async getLastVersionUsedOfPlayer(playerID: nanoid): Promise<number> {
    return Promise.resolve(this.lastVersionUsed.get(playerID));
  }

  public async updateLastVersionUsedOfPlayer(
    playerID: nanoid,
    version: number
  ): Promise<void> {
    this.lastVersionUsed.set(playerID, version);
    return;
  }

  /**
   * Removes a match by id. Returns true if deleted, false if nothing was deleted
   */
  public async removeMatch(matchID: NanoID): Promise<boolean> {
    if (this.matches.has(matchID)) {
      const match = this.matches.get(matchID);
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

    const destroyPromises = [];

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
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  protected async preInternalDestroy(): Promise<void> {}

  /**
   * Post run function before generic destroy takes place
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  protected async postInternalDestroy(): Promise<void> {}

  /**
   * Generates a 6 character tournament ID identifying this tournament class instance. Not to be confused with
   * {@link Tournament.ID} which is the ID for competitors in the tournament
   */
  public static genTournamentClassID(): string {
    return genID(6);
  }

  /**
   * Returns the name of the tournament but formatted (no spaces)
   */
  public getSafeName(): string {
    return this.name.replace(/ /g, '_');
  }

  /**
   * Returns a key name to be used when storing a tournament by a combination of its name and id
   */
  public getKeyName(): string {
    return `${this.getSafeName()}_${this.id}`;
  }

  /**
   * Resolves with player stats if player with the id exists. Includes database user if db contains the player
   * Fields are null if they don't exist. If playerStat field is null, then this player does not exist
   *
   * @param id - id of player to get
   */
  public async getPlayerStat(
    id: nanoid
  ): Promise<{ user: Database.User; playerStat: Tournament.PlayerStatBase }> {
    // TODO: Add caching as an option
    if (!this.state.playerStats.has(id)) {
      if (this.dimension.hasDatabase()) {
        let user: Database.User;
        try {
          user = await this.dimension.databasePlugin.getUser(id);
        } catch (err) {
          this.log.error(err);
          throw new DatabaseGetUserError(
            `failed to get database user with id: ${id}`
          );
        }
        if (user && user.statistics[this.getKeyName()]) {
          return { user: user, playerStat: user.statistics[this.getKeyName()] };
        }
      }
    } else {
      return { user: null, playerStat: this.state.playerStats.get(id) };
    }
    return { user: null, playerStat: null };
  }
}

// some imports moved to here to avoid circular issues with using values
import { Ladder as LadderTournament } from './Ladder';
/** @ignore */
// import LadderTournament = LadderDefault.Ladder;

import { Elimination as EliminationTournament } from './Elimination';
/** @ignore */
// import EliminationTournament = EliminationDefault.Elimination;

import { Scheduler as SchedulerClass } from './Scheduler';
/** @ignore */
// import SchedulerClass = SchedulerDefault.Scheduler;

export namespace Tournament {
  // Re-export tournament classes/namespaces
  /* eslint-disable */
  export import Ladder = LadderTournament;
  export import Elimination = EliminationTournament;
  export import Scheduler = SchedulerClass;

  // Re-export some types
  export import Type = _TOURNAMENT_TYPE;
  export import Status = _TournamentStatus;
  export import RankSystem = _RankSystem;

  /* eslint-enable */

  /**
   * Required and Optional Tournament configurations
   */
  export interface TournamentConfigsBase {
    /**
     * The default match configurations to be applied throughout all tournament matches
     */
    defaultMatchConfigs?: DeepPartial<Match.Configs>;
    /**
     * The tournament type to run. See {@link Tournament.Type}
     */
    type: Type;
    /**
     * The ranking system to use for this tournament. Either a string or a class that extends RankSystem
     */
    rankSystem: RankSystem<any, any> | Tournament.RankSystemTypes;

    /**
     * The result handler for returning the appropriate results to the tournament for processing.
     *
     * To find what kind of result should be returned, find the Results interface for the rank system you are using.
     *
     * Example: For {@link Tournament.RankSystem.TRUESKILL}, go to {@link Tournament.RankSystem.TRUESKILL.Results}
     */
    resultHandler: /**
     * @param results - the results received from calling the {@link Design.getResults} function
     */
    (results: any) => any;

    /**
     * The configurations for a specified rank system. For example, see {@link RankSystem.WINS.Configs},
     * {@link RankSystem.TRUESKILL.Configs}
     */
    rankSystemConfigs?: any;

    /**
     * The tournament wide logging level to enforce
     */
    loggingLevel?: Logger.LEVEL;

    /**
     * The name of the tournament
     */
    name?: string;

    /**
     * Tournament configurations. Dependent on the type of tournament chosen
     * Example: For {@link Ladder}, go to {@link Ladder.Configs}
     */
    tournamentConfigs?: any;

    /**
     * An array of valid number of players that can compete in a match. For Rock Paper Scissors for example this would
     * be [2]
     * @default `[2]`
     */
    agentsPerMatch: Array<number>; // an array of valid players per match

    /**
     * Whether or not to display a continuous console log of the current tournament as it runs
     * @default `true`
     */
    consoleDisplay?: boolean;

    /**
     * Set this ID to override the generated ID
     */
    id?: string;
  }

  /**
   * Queued match information, consisting of player IDs of players to compete
   */
  export type QueuedMatch = Array<nanoid>;

  /**
   * Internally used type.
   */
  export interface TournamentConfigs<ConfigType> extends TournamentConfigsBase {
    tournamentConfigs: ConfigType;
    rankSystemConfigs: any;
  }

  export interface TournamentTypeConfig {
    /**
     * Whether or not to store past results using the specified option of the dimension (database or in memory)
     * @default `true`
     */
    storePastResults: boolean;
  }
  export interface TournamentTypeState {
    /**
     * Past results stored. Each element is what is returned by {@link Design.getResults}
     */
    results: Array<any>;

    /**
     * Map from player ID to player stats
     */
    playerStats: Map<NanoID, PlayerStatBase>;
  }

  /**
   * Tournament.ID. Represents an identifier for players competing in a {@link Tournament}
   */
  export interface ID {
    /** A string id. This should never change */
    readonly id: NanoID;
    /** A display name */
    name: string;

    /** Associated username if there is one. */
    username: string;
  }

  export interface PlayerStatBase {
    player: Player;
    matchesPlayed: number;
  }

  export enum Events {
    /**
     * Event is emitted when initialAddPlayerPromises resolves. This involves all players initialized to tournament
     * upon initialization of tournament instance
     */
    INITIAL_PLAYERS_INITIALIZED = 'initial_players_initialized',

    /**
     * Event is emitted whenever a match runs
     */
    MATCH_RAN = 'match_ran',

    /**
     * Event is emitted whenever a match runs AND the tournament is completely done handling it.
     */
    MATCH_HANDLED = 'match_handled',
  }

  export enum RankSystemTypes {
    /** Ranking by wins, ties and losses */
    WINS = 'wins',
    /** Ranking by the ELO ranking system */
    ELO = 'elo',
    /** Ranking by Microsoft's Trueskill */
    TRUESKILL = 'trueskill',
  }
}
