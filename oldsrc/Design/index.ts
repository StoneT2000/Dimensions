import { deepMerge } from '../utils/DeepMerge';
import { DeepPartial } from '../utils/DeepPartial';
import { deepCopy } from '../utils/DeepCopy';

import { Match } from '../Match';
import { MatchEngine } from '../MatchEngine';
import { Logger } from '../Logger';

/** @ignore */
import EngineOptions = MatchEngine.EngineOptions;
/** @ignore */
import Command = MatchEngine.Command;

/**
 * @class Design
 * @classdesc Abstract class detailing a Design to be used as the platform that holds match lifecycle logic for
 * updating and manipulating ongoing matches
 *
 * Refer to {@link Match} class and the {@link Agent} for exposed fields available for user's use when making your own
 * Design
 *
 * The important functions to implement are {@link initialize}, {@link update}, and {@link getResults}
 *
 */
export abstract class Design {
  /** The current design options */
  protected designOptions: DesignOptions;

  /** Logger */
  public log = new Logger();

  /**
   * Design constructor
   * @param name - The name of the design
   * @param designOptions - The options for this design
   */
  constructor(
    public name: string,
    designOptions: DeepPartial<DesignOptions> = {}
  ) {
    // Copy defaults
    this.designOptions = deepCopy(DefaultDesignOptions);

    // Override with user provided params
    deepMerge(this.designOptions, designOptions);

    this.log.detail(`Design + MatchEngine Options`, this.designOptions);
    // Set log level to default
    this.log.level = Logger.LEVEL.INFO;
    this.log.system(`Initialized Design: ` + this.name);
  }

  /**
   * Set log level of the design
   * @param level - level to set design logger to
   */
  setLogLevel(level: Logger.LEVEL): void {
    this.log.level = level;
  }

  /**
   * Get the design options associated with this `Design`
   */
  getDesignOptions(): DesignOptions {
    return this.designOptions;
  }

  /**
   * Abstract function required to initialize match state and send relevant information to
   * agents participating in the match
   * @see {@link Agent} for what properties and methods related to agents are exposed to the user for use.
   * @see {@link Match} for what properties and methods are exposed to the user for use e.g match.send() and match.state
   *
   * @param match - The {@link Match} to initialize state with
   * @returns Nothing needed, return result is not used by `match`
   */
  abstract initialize(match: Match): Promise<void>;

  /**
   * Abstract function required to update match state with commands from Agents and send commands to Agents
   * along with returning the current match status. Returning {@link Match.Status.RUNNING} indicates the match is not done yet.
   * Returning {@link Match.Status.FINISHED} indicates the match is over.
   *
   * @see {@link Match} - This function is used by the match to update the match state and move forward a time step
   * @see {@link Agent} for what properties and methods related to agents are exposed to the user for use.
   * @see {@link Match.Status} for different statuses you can return.
   *
   * @param match - The Match to update state with the given Commands
   * @param commands - The {@link MatchEngine.Command} array used to update the state in a Match.
   *                   Each element has two keys, command and agentID. agentID is the id of the agent that outputted
   *                   that string in command
   * @returns A promise that resolves with the current {@link Match.Status} at the end of this time step. Can also
   * directly just return the match status
   */
  abstract update(
    match: Match,
    commands: Array<Command>
  ): Promise<Match.Status>;

  /**
   * Abstract function required to get the result of a {@link Match}.
   *
   * @see {@link Match} - This function is used by the match to update the results stored in the match and return
   * results
   *
   * @see {@link Tournament} - This function is used to return results from a match and then is fed into a resultHandler
   * for a particular rankingSystem and tournament type.
   *
   * @param match - The `Match` used to process results
   * @param config - Any user configurations that can be added as parameters
   * @returns A promise that resolves with results (can be an object, number, anything). Can also directly just return
   *          the results
   */
  abstract getResults(match: Match): Promise<any>;

  /**
   * Creates a Design class wrapper around a custom design written without the use of Dimensions framework
   */
  public static createCustom(
    name: string,
    overrideOptions: DeepPartial<Design.OverrideOptions>
  ): Design {
    return new CustomDesign(name, overrideOptions);
  }
}

/**
 * This class is meant for wrapping around existing designs built without the use of Dimensions framework
 *
 * This is created so a user provided non-dimension framework based design can be used within the Dimensions framework
 * and leverage other features such as tournament running, an API for viewing relevant data, and automatic, scalable
 * competition running
 */
class CustomDesign extends Design {
  constructor(
    name: string,
    overrideOptions: DeepPartial<Design.OverrideOptions>
  ) {
    // this should always be true
    overrideOptions.active = true;
    // pass in the override options to Design
    super(name, {
      override: overrideOptions,
    });
  }

  /**
   * Initializer. Declares any relevant state fields
   */
  async initialize(match: Match) {
    match.state = {
      matchOutput: [],
    };
    match.results = [];
    return;
  }

  /**
   * Empty function, not used
   */
  /* istanbul ignore next */
  async update(): Promise<Match.Status> {
    return;
  }

  /**
   * Returns the results stored. {@link MatchEngine.runCustom} should automatically populate match.results for us and so
   * we just return itt.
   * @param match - Match to get results of
   */
  async getResults(match: Match) {
    return match.results;
  }
}

/**
 * Design options. Allows for the setting of engine options and override options.
 */
export interface DesignOptions {
  /**
   * The default engine options to use for all matches created using this design. Engine options impact how the engine
   * works at the I/O level and dictates how your engine prohibits and enables an {@link Agent} in a {@link Match} to
   * communicate and send commands and receive commands.
   *
   * This overrides the default engine options from the {@link MatchEngine} class, and is overided by tournament
   * level, and then match level configs.
   */
  engineOptions?: EngineOptions;

  /**
   * Override configurations if a user wants to run matches with a non-dimensions based design and run their own design
   * This is what allows users to write competition designs in their own programming language and utilize Dimensions
   * features such as tournament running, database plugins, scalability, and much more automation.
   */
  override: Design.OverrideOptions;
}

/**
 * Default Design Options
 */
export const DefaultDesignOptions: DesignOptions = {
  override: {
    active: false,
    command: 'echo NO COMMAND PROVIDED',
    conclude_command: 'D_MATCH_FINISHED',
    arguments: [],
    timeout: 1000 * 60 * 10, // 10 minutes
    resultHandler: null,
  },
};

export namespace Design {
  /**
   * The override options interface
   * This is used to provide configurations for a custom {@link Design} outside the scope and infrastructure of
   * Dimensions
   */
  export interface OverrideOptions {
    /**
     * Whether or not to use the override configurations
     *
     * @default `false` in a normal design using Dimensions
     * @default `true` in a custom design running a custom match
     */
    active: boolean;

    /**
     * The command to run that will run a match and send to the standard out any updates and
     * and match conclusion data. This is always executed in the same directory the dimension is created in.
     *
     * @example ./run.sh
     * @example python3 path/to/matchrunner/run.py
     * @default `echo NO COMMAND PROVIDED`
     */
    command: string;

    /**
     * An array of arguments to pass in to the script command
     * NOTE, there are a few special strings when put into this array, will be populated with dynamic data.
     *
     * See {@link MatchEngine.DynamicDataStrings} for what is available and what they do
     *
     * @example ['--debug=false', 'D_FILES', '--replay-directory=my_replays', '--some-option=400']
     */
    arguments: Array<string | MatchEngine.DynamicDataStrings>;

    /**
     * The command telling the engine that the match is done and should now process the remaining lines as results until
     * the process running the match exits.
     *
     * @default `D_MATCH_FINISHED`
     */
    conclude_command: string;

    /**
     * Number in milliseconds before a match is marked as timing out and thrown out. When set to null, no timeout
     * is used. This is dangerous to set to null, if you are to set it null, ensure your own design has some timing
     * mechanism to ensure matches don't run forever and consume too much memory.
     *
     * @default `600000`, equivalent to 10 minutes
     */
    timeout: number;

    /**
     * The result handler to handle results returned by the command provided in the {@link OverrideOptions}.
     *
     * If the result handler returns an object with the key `replayFile`, Dimensions will recognize the string
     * in that key as the replay file location.
     *
     * If a {@link Storage} plugin is used, the replay file is uploaded and the local fle is deleted
     */
    resultHandler: (results: Array<string>) => any;
  }
}
