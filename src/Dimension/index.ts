import { Design, Match, Logger, LoggerLEVEL, MatchConfigs, MatchStatus } from '..';
import { FatalError } from '../DimensionError';

/**
 * @class Dimension
 * @classdesc The Dimension framework for intiating a `Design` to then run `Matches` on. Interacts with `Match` class
 * only
 * 
 * @param loggingLevel - Specified logging level applied to entire Dimension, including the associated design and sets
 * the defaults for all future `matches`, `matchEngines` and `agents`
 */
export class Dimension {
	
	public matches: Array<Match> = [];
	public nameToMatches: Map<string, Match>;
	static id: number = 0;
	public name: string;

	public log = new Logger();

	public defaultMatchConfigs: MatchConfigs = { loggingLevel: Logger.LEVEL.INFO }

	constructor(public design: Design, name?: string, public loggingLevel: LoggerLEVEL = Logger.LEVEL.INFO) {
		this.log.level = loggingLevel;
		this.defaultMatchConfigs.loggingLevel = loggingLevel;

		this.design._setLogLevel(loggingLevel);

		if (name) {
			this.name = name;
		}
		else {
			this.name = `dimension_${Dimension.id}`;
		}

		this.log.detail(`Created Dimension: ` + this.name);
		Dimension.id++;
	}
	/**
	 * Create a match with the given files with the given unique name. It rejects if a fatal error occurs and resolves 
	 * with the initialized `match` object as specified by the `Design` of this `Dimension`
	 * 
	 * @param files - List of files to use to generate agents and use for a new match
	 * @param matchOptions - Options for the created match
	 * @param configs - Configurations that are `Design` dependent
	 */
	public async createMatch(files: Array<string> | Array<{file: string, name: string}>, configs: MatchConfigs = {}): Promise<Match> {
		return new Promise( async (resolve, reject) => {

			if (!files.length) reject(new FatalError('No files provided for match'));

			// override defaults with provided configs
			// TOOD: change to deep copy
			let matchConfigs = {...this.defaultMatchConfigs};
			Object.assign(matchConfigs, configs);

			let match: Match;
			if (typeof files[0] === 'string') {
				match = new Match(this.design, <Array<string>> files, matchConfigs);
			} else {
				match = new Match(this.design, <Array<{file: string, name: string}>> files, matchConfigs);
			}
			this.matches.push(match);

			// Initialize match with initialization configuration
			try {
				await match.initialize();
			}
			catch(error) {
				reject(error);
			}
			
			// TODO: Add a automatic match resolve that removes match from dimension's own list of matches

			resolve(match);
		});
	}

	/**
	 * Runs a match with the given files with the given unique name. It rejects if a fatal error occurs and resolves 
	 * with the results of the match as specified by the `Design` of this `Dimension`
	 * 
	 * @param files - List of files to use to generate agents and use for a new match
	 * @param matchOptions - Options for the created match
	 * @param configs - Configurations that are `Design` dependent. These configs are passed into `Design.initialize`
	 * `Design.update` and `Design.storeResults`
	 */
	public async runMatch(files: Array<string> | Array<{file: string, name: string}>, configs: MatchConfigs = {}) {
		return new Promise( async (resolve, reject) => {
			
			if (!files.length) throw new FatalError('No files provided for match');

			// override defaults with provided configs
			// TOOD: change to deep copy
			let matchConfigs = {...this.defaultMatchConfigs};
			Object.assign(matchConfigs, configs);

			let match: Match;
			if (typeof files[0] === 'string') {
				match = new Match(this.design, <Array<string>> files, matchConfigs);
			} else {
				match = new Match(this.design, <Array<{file: string, name: string}>> files, matchConfigs);
			}
			this.matches.push(match);
			

			// Initialize match with initialization configuration
			await match.initialize();

			let status: MatchStatus;
			// Run match
			do {
				status = await match.run();
			}
			while (status != MatchStatus.FINISHED)
			
			// Store results
			await match.storeResults();

			// remove match from list
			for (let i = 0; i < this.matches.length; i++) {
				if (this.matches[i].id === match.id) {
					this.matches.splice(i, 1);
				}
			}

			// Resolve the results
			resolve(match.results);
		});
	}

}

/**
 * Creates a dimension for use to start matches, run tournaments, etc.
 * @param design The design to use
 * @param name The optional name of the dimension
 */
export function create(design: Design, name?: string, loggingLevel?: LoggerLEVEL): Dimension {
	return new Dimension(design, name, loggingLevel);
}