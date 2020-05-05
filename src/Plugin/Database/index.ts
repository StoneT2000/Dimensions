import { DeepPartial } from "../../utils/DeepPartial";
import { deepMerge } from "../../utils/DeepMerge";
import { NanoID } from "../../Dimension";
import { Match } from "../../Match";
import { Plugin } from "..";

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
  abstract async initialize(): Promise<any>

  /**
   * Stores any match related data. Typically will just store match results
   * Resolves when done
   */
  abstract storeMatch(match: Match): Promise<any>;

  /**
   * Retrieves a match through its match ID
   * @param id - a NanoID
   */
  abstract getMatch(id: NanoID): Promise<any>;

  /**
   * TODO: Add user CRUD
   * Add loginUser, authUser, registerUser, deleteUser, updateUser
   */

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
   * Authenticates a user by a JWT, resolves if succesful, rejects otherwise
   * @param jwt - the token
   */
  abstract verifyToken(jwt: string): Promise<any>

  /**
   * Deletes the user with this username or ID (generated nanoID)
   * @param usernameOrID
   */
  abstract deleteUser(usernameOrID: string): Promise<any>

  /**
   * Gets user information. If publicView is `false`, will retrieve all information other than password
   * @param usernameOrID 
   * @param publicView
   */
  abstract getUser(usernameOrID: string, publicView?: boolean): Promise<Database.User>
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
   * User interface for use by Database Plugins
   */
  export interface User {

    /** User's username */ 
    username: string,
    /** Hashed password */
    passwordHash: string,

    /** Related Statistics */
    statistics?: any,
    /** Creation date of the user */
    creationDate?: Date,
    /** A Player ID generated using {@link Player.generatePlayerID}, returning a 12 char nanoid */
    playerID?: NanoID
  }
}