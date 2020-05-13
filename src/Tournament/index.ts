import { Match } from '../Match';
import { Design } from '../Design';
import { FatalError, MatchError, TournamentError } from '../DimensionError'

import { DeepPartial } from '../utils/DeepPartial';
import { Logger } from '../Logger';

import { RankSystem } from './RankSystem';
import { deepCopy } from '../utils/DeepCopy';
import { Dimension, NanoID } from '../Dimension';
import { genID } from '../utils';
import { TournamentStatus } from './TournamentStatus';
import { TournamentType } from './TournamentTypes';

/** @ignore */
import _RankSystem = RankSystem;
/** @ignore */
import _TOURNAMENT_TYPE = TournamentType;
/** @ignore */
import _TournamentStatus = TournamentStatus;

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

  /** Associated username if there is one */
  public username: string = undefined;
  constructor(public tournamentID: Tournament.ID, public file: string) {

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
 * {@link RoundRobin}, {@link Ladder}, {@link Elimination}
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
  abstract state: unknown;

  /** Logger */
  public log = new Logger();

  /** Registered competitors in this tournament */
  public competitors: Map<NanoID, Player> = new Map();

  private playerID = 0;

  /** A reference to the dimension this tournament was spawned from */
  public dimension: Dimension;

  /** This tournament's ID */
  public id: NanoID;

  /**
   * This Tournament's name
   */
  public name = '';

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
    
    // if no name is provided but database is being used, log a warning
    if (!tournamentConfigs.name && dimension.hasDatabase()) {
      this.log.warn(`A name has to be specified for a tournament otherwise tournament player data will not be reused across runs of the tournament`)
    }

  }

  /**
   * Add a player to the tournament. Can specify an ID to use. If that ID exists already, this will update the file for 
   * that player instead
   * 
   * If the player is to exist beyond the tournament, an existingID must always be provided and generated somewhere else
   * 
   * Resolves with the new player or updated player
   * 
   * @param file - The file to the bot or an object with the file and a name for the player specified
   * @param existingID - The optional id of the player 
   * 
   */
  public async addplayer(file: string | {file: string, name: string}, existingID?: NanoID): Promise<Player> {
    let id: NanoID;
    if (existingID) {
    
      if (this.competitors.has(existingID)) {
        // bot exists in tournament already
        let player = this.competitors.get(existingID);
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
      let newPlayer = new Player({id: id, name: name}, file);

      // check database
      if (this.dimension.hasDatabase()) {
        let user = await this.dimension.databasePlugin.getUser(newPlayer.tournamentID.id);
        if (user) {
          newPlayer.anonymous = false;
          newPlayer.username = user.username;
        }
      }
      this.competitors.set(id, newPlayer);
  
      this.internalAddPlayer(newPlayer);
      return newPlayer;
    }
    else {
      let newPlayer = new Player({id: id, name: file.name}, file.file);

      // check database
      if (this.dimension.hasDatabase()) {
        
        let user = await this.dimension.databasePlugin.getUser(newPlayer.tournamentID.id);
        if (user) {
          newPlayer.anonymous = false;
          newPlayer.username = user.username;
        }
      }

      this.competitors.set(id, newPlayer);

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
   * Returns true if the id given is associated to this tournament and valid for use
   */
  public validateTournamentID(id: string) {
    let content = id.split('_');
    if (content.length !== 2) {
      return false;
    }
    let playerID = content[1];
    // may not be the safest way to determine
    // @ts-ignore
    if (isNaN(parseInt(playerID)) || !(parseInt(playerID) == playerID)) {
      return false;
    }
    if (content[0][0] !== 't') {
      return false;
    }
    let tourneyID = content[0].slice(1);
    // @ts-ignore
    if (isNaN(parseInt(tourneyID)) || parseInt(tourneyID) !== this.id || !(parseInt(tourneyID) == tourneyID)) {
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

    // if database plugin is active and saveTournamentMatches is set to true, store match
    if (this.dimension.hasDatabase()) {
      if (this.dimension.databasePlugin.configs.saveTournamentMatches) {
        this.dimension.databasePlugin.storeMatch(match);
      }
    }

    // remove the match from the active matches list
    this.matches.delete(match.id);
    // TODO: Add option to just archive matches instead
    
    // Resolve the results
    return {results: results, match: match};
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
}

// some imports moved to here to avoid circular issues with using values
import { Ladder } from './Ladder';
/** @ignore */
import LadderTournament = Ladder;
import { RoundRobin } from './RoundRobin';
/** @ignore */
import RoundRobinTournament = RoundRobin;
import { Elimination } from './Elimination';
/** @ignore */
import EliminationTournament = Elimination;

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
     * The tournament type to run. See {@link TOURNAMENT_TYPE}
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
     * @default true
     */
    consoleDisplay?: boolean

    /**
     * Set this ID to override the generated ID 
     */
    id?: string
  }

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

  // Re-export tournament classes/namespaces
  export import Ladder = LadderTournament; 
  export import RoundRobin = RoundRobinTournament;
  export import Elimination = EliminationTournament;
}


