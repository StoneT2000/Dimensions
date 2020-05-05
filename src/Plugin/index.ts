import { Dimension } from "../Dimension";

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