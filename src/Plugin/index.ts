import { Dimension } from '../Dimension';

/**
 * Abstract Plugin class to be inherited in the development of external tooling to manipulate a {@link Dimension}
 *
 * There are specific {@link Database} plugins which are used for setting up a backing database to the dimension so it
 * can automatically store relevant data such as matches and tournaments and player stats
 */
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
   * Manipulates the dimension as necessary for this plugin. Should resolve when done
   * @param dimension - the dimension the plugin is being applied on
   */
  abstract async manipulate(dimension: Dimension): Promise<void>;
}

import { Database as _Database } from './Database';
/** @ignore */
// import _Database = DatabaseDefault.Database;
import { Storage as _Storage } from './Storage';
// import StorageDefault = require('./Storage');
/** @ignore */
// import _Storage = StorageDefault.Storage;

export namespace Plugin {
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
    STORAGE = 'storage',

    /**
     * Other type, of which we will only run the {@link Plugin.manipulate} function
     */
    OTHER = 'other',
  }

  // re-export some classes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export import Database = _Database;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export import Storage = _Storage;
}
