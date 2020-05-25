import { DeepPartial } from "../../utils/DeepPartial";
import { deepMerge } from "../../utils/DeepMerge";
import { NanoID, Dimension } from "../../Dimension";
import { Match } from "../../Match";
import { Plugin } from "..";
import { nanoid } from "../..";
import { Ladder } from "../../Tournament/Ladder";
import { Tournament } from "../../Tournament";

/**
 * The database plugin class, of which Dimensions uses internally to store data onto the database
 * Must be extended in order to be used as a database plugin
 */
export abstract class Database extends Plugin {

  constructor(configs: DeepPartial<Database.Configs>) {
    super();
    deepMerge(this.configs, configs);
  }

  /** Default configs */
  public configs: Database.Configs = {
    saveMatches: true,
    saveTournamentMatches: true
  }
  /**
   * Performs any intialization tasks
   * Resolves when done
   */
  abstract async initialize(dimension: Dimension): Promise<any>

  /**
   * Stores any match related data. Typically will just store match results
   * @param match - the match to store
   * @param governId - a form of identification. Indicates what created this match. This can be a dimension ID or tournament 
   * ID, both of which are {@link nanoid | nanoids}
   * 
   * Resolves when done
   */
  abstract storeMatch(match: Match, governID: nanoid): Promise<any>;

  /**
   * Retrieves a match through its match ID
   * @param id - a NanoID
   */
  abstract getMatch(id: NanoID): Promise<any>;

  /**
   * Returns a list of player stats based on their rankings from database. Used for Ladder Tournaments
   * @param tournament - The tournament to retrieve rankings for
   */
  abstract getRanks(tournament: Tournament.Ladder): Promise<Array<Ladder.PlayerStat>>

  /**
   * Logs in a user, resolves with a JWT (JSON Web Token), rejects otherwise
   * @param username - unique username to login with
   * @param password - the password for the user with that username
   */
  abstract loginUser(username: string, password: string): Promise<any>

  /**
   * Registers a user, resolves when succesful, rejects otherwise
   * @param username - username to register with
   * @param password - the password for the user
   * @param userData - any other kind of user data (not used)
   */
  abstract registerUser(username: string, password: string, userData?: any): Promise<any>

  /**
   * Authenticates a user by a JWT, resolves with the token data signed in the {@link loginUser} function, 
   * rejects otherwise
   * @param jwt - the token
   */
  abstract verifyToken(jwt: string): Promise<any>

  /**
   * Deletes the user with this username or ID (generated nanoID)
   * @param usernameOrID
   */
  abstract deleteUser(usernameOrID: string): Promise<any>

  /**
   * Updates the user with this username or ID (generated nanoID) with the provided data
   * @param usernameOrID
   * @param update
   */
  abstract updateUser(usernameOrID: string, update: Partial<Database.User>): Promise<any>

  /**
   * Gets user information. If publicView is `true`, will retrieve all non-sensitive information (so it should exclude 
   * password. Resolves with null if no user found
   * @param usernameOrID 
   * @param publicView
   */
  abstract getUser(usernameOrID: string, publicView?: boolean): Promise<Database.User>

  /**
   * Gets all users with statistics in a tournament specified by the tournamentKeyName, which is a string that is the 
   * key stored in the user's statistics property mapping to the tournament's statistics
   * @param tournamentKeyName 
   * @param publicView
   */
  abstract getUsersInTournament(tournamentKeyName: string): Promise<Array<Database.User>>

  /**
   * Returns true if the user info indicate the user is an admin
   */
  abstract isAdmin(user: Database.PublicUser): boolean

  /**
   * Resolves with match data
   * @param playerID - id of player to retrieve matches from
   * @param governID - id of what created the matches. This can be a dimension ID or a tournament ID
   * @param offset - offset
   * @param limit - max number of matches to return
   * @param order - 1 for ascending and -1 for descending in order of creation date
   */
  abstract getPlayerMatches(playerID: nanoid, governID: nanoid, offset: number, limit: number, order: number): Promise<Array<Match>>
}

export module Database {

  /**
   * Configuration interface for the {@link Database} plugin
   */
  export interface Configs {

    /** Whether or not to save matches into the database when we run {@link Dimension.runMatch} */
    saveMatches: boolean,

    /** Whether or not to save matches into the database when the tournament runs a match */
    saveTournamentMatches: boolean
  }

  /**
   * Public information retrievable about users
   */
  export interface PublicUser {
    /** User's username */ 
    username: string,

    /** Related Statistics */
    statistics?: {
      [x in string]: any
    },
    /** Creation date of the user */
    creationDate?: Date,
    /** A Player ID generated using {@link Player.generatePlayerID}, returning a 12 char nanoid */
    playerID?: NanoID

    /** any other user related meta data such as email, user statistics, etc. */
    meta?: {
      [x in string]: any
    }
  }

  /**
   * User interface for use by Database Plugins
   */
  export interface User extends PublicUser{
    /** Hashed password */
    passwordHash: string
  }

  
}