import { Dimension } from "../Dimension";
import { Match } from "../Match";
import { DeepPartial } from "../utils/DeepPartial";
import { deepMerge } from "../utils/DeepMerge";

export abstract class Plugin {

  /**
   * Name of the plugin
   */
  abstract name: string;

  /**
   * Type of the plugin. Required in order for Dimensions to know how to use it
   */
  abstract type: Plugin.Type;

  /**
   * Manipulates the dimension as necessary for this plugin
   * @param dimension - the dimension the plugin is being applied on
   * Should resolve when done
   */
  abstract async manipulate(dimension: Dimension): Promise<void>;
}

/**
 * The database plugin class, of which Dimensions uses internally to store data onto the database
 * Must be extended in order to be used as a database plugin
 */
export abstract class DatabasePlugin extends Plugin {

  constructor(configs: DeepPartial<DatabasePlugin.Configs>) {
    super();
    deepMerge(this.configs, configs);
  }

  /** Default configs */
  public configs: DatabasePlugin.Configs = {
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
   * TODO: Add user CRUD
   * Add loginUser, authUser, registerUser, deleteUser, updateUser
   */

}

export module DatabasePlugin {

  /**
   * Configuration interface for the {@link DatabasePlugin}
   */
  export interface Configs {

    /** Whether or not to save matches into the database when we run {@link Dimension.runMatch} */
    saveMatches: boolean,

    /** Whether or not to save matches into the database when the tournament runs a match */
    saveTournamentMatches: boolean
  }
}

export module Plugin {

  /**
   * Enumeration for plugin types
   */
  export enum Type {

    /** 
     * Plugins that work with database capabilities
     * Includes plugins such as {@link MongoDB}, which handle the storage of match results and user data
     */
    DATABASE = 'database',

    /** 
     * Plugins that work with the file storage capabilities 
     * Currently not used
     */
    FILE_STORE = 'fileStore',

    /**
     * Other type, of which we will only run the {@link Plugin.manipulate} function
     */
    OTHER = 'other'
  }
}