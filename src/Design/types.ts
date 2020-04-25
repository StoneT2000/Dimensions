export module Design {
  
  /**
   * The override options interface
   * This is used to provide configurations for a custom {@link Design} outside the scope and infrastructure of 
   * Dimensions
   */
  export interface OverrideOptions {
    /**
     * Whether or not to use the override configurations
     * 
     * @default `false`
     */
    active: boolean,

    /**
     * The command to run that will run a match and send to the standard out any updates and
     * and match conclusion data. This is always executed in the same directory the dimension is created in.
     * 
     * @example ./run.sh
     * @example python3 path/to/matchrunner/run.py
     * @default `echo NO COMMAND PROVIDED`
     */
    command: string,

    /**
     * An array of arguments to pass in to the script command
     * NOTE, there are a few special strings when put into this array, will be populated with dynamic data. 
     * 
     * See {@link DynamicDataStrings} for what is available and what they do
     * 
     * @example ['--debug=false', 'D_FILES', '--replay-directory=my_replays', '--some-option=400']
     */
    arguments: Array<string | Design.DynamicDataStrings>

    /**
     * The command telling the engine that the match is done and should now process the remaining lines as results until
     * the process running the match exits.
     * 
     * @default `D_MATCH_FINISHED`
     */
    conclude_command: string,

    /**
     * Number in milliseconds before a match is marked as timing out and thrown out. When set to null, no timeout
     * is used. This is dangerous to set to null, if you are to set it null, ensure your own design has some timing
     * mechanism to ensure matches don't run forever and consume too much memory.
     * 
     * @default `600000`, equivalent to 10 minutes
     */
    timeout: number

  }

  /**
   * Dynammic Data strings are strings in the {@link OverrideOptions} arguments array that are automatically replaced
   * with dynamic data as defined in the documentation of these enums
   */
  export enum DynamicDataStrings {
    /**
     * D_FILES is automatically populated by a space seperated string list of the file paths provided for each of the 
     * agents competing in a match. 
     * NOTE, these paths don't actually need to be files, they can be directories or anything that works with 
     * your own command and design
     * 
     * @example Suppose the paths to the sources the agents operate on are `path1, path2, path3`. Then `D_FILES` will 
     * be passed into your command as `path1 path2 path3`
     */
    D_FILES = 'D_FILES',

    /**
     * D_AGENT_IDS is automatically populated by a space seperated string list of the agent IDs of every agent being
     * loaded into a match in the same order as D_FILES. This should always be sorted by default as agents are loaded
     * in order from agent ID `0` to agent ID `n`
     * 
     * @example Suppose a match is running with agents with IDs `0, 1, 2, 3`. Then `D_AGENT_IDS` will be passed into 
     * your command as `0 1 2 3`
     */
    D_AGENT_IDS = 'D_AGENT_IDS',

    /**
     * D_TOURNAMENT_IDS is automatically populated by a space seperated string list of the tournament ID numbers of
     * the agents being loaded into the match in the same order. If no tournament is being run all the ID numbers will 
     * default to 0 but still be passed in to the command you give for the override configurations
     * 
     * @example Suppose a match in a tournament with ID 0 is running 4 agents with tournament IDs t0_1, t0_9, t0_11, 
     * t0_15. Then `D_TOURNAMENT_IDS` will be passed into your command as `t0_1 t0_0 t0_11 t0_15`
     */
    D_TOURNAMENT_IDS = 'D_TOURNAMENT_IDS'
  }
}