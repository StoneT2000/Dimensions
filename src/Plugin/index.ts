import { Dimension } from "../Dimension";
import { Match } from "../Match";

export abstract class Plugin {

  abstract type: Plugin.Type
  /**
   * Manipulates the dimension as necessary for this plugin
   * @param dimension - the dimension the plugin is being applied on
   */
  abstract manipulate(dimension: Dimension): void;
}

/**
 * The database plugin class, of which Dimensions uses internally to store data onto the database
 * Must be extended in order to be used as a database plugin
 */
export abstract class DatabasePlugin extends Plugin {

  /**
   * Performs any intialization tasks
   */
  abstract initialize(): Promise<any>

  /**
   * Stores any match related data. Typically will just store match results
   */
  abstract storeMatch(match: Match): Promise<any>;

  /**
   * TODO: Add user CRUD
   * Add loginUser, authUser, registerUser, deleteUser, updateUser
   */

}

export module Plugin {
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