import { Tournament, Player } from "..";
import { DeepPartial } from "../../utils/DeepPartial";
import { Design } from '../../Design';
import { deepMerge } from "../../utils/DeepMerge";
import { MatchDestroyedError, TournamentError, NotSupportedError, TournamentPlayerDoesNotExistError } from "../../DimensionError";
import { Agent } from "../../Agent";
import { Rating, rate, quality, TrueSkill } from "ts-trueskill";
import { sprintf } from 'sprintf-js';
import { Logger } from "../../Logger";
import { ELOSystem, ELORating } from "../ELO";
import { Dimension, NanoID } from "../../Dimension";
import { Database } from "../../Plugin/Database";
import { TournamentStatus} from "../TournamentStatus";
import { RankSystem } from "../RankSystem";
import { TournamentType } from "../TournamentTypes";

import LadderState = Ladder.State;
import LadderConfigs = Ladder.Configs;
import LadderPlayerStat = Ladder.PlayerStat;
import { nanoid } from "../..";

/**
 * The Ladder Tournament class and namespace. 
 */
export class Ladder extends Tournament {
  configs: Tournament.TournamentConfigs<LadderConfigs> = {
    defaultMatchConfigs: {},
    type: TournamentType.LADDER,
    rankSystem: null,
    rankSystemConfigs: null,
    addDatabasePlayers: true,
    tournamentConfigs: {
      maxConcurrentMatches: 1,
      endDate: null,
      storePastResults: true,
      maxTotalMatches: null
    },
    resultHandler: null,
    agentsPerMatch: [2],
    consoleDisplay: true,
    id: 'z3plg'
  }
  state: LadderState = {
    playerStats: new Map(),
    currentRanks: [],
    results: [],
    statistics: {
      totalMatches: 0
    }
  };

  /**
   * ELO System used in this tournament
   */
  private elo: ELOSystem;

  // queue of the results to process
  resultProcessingQueue: Array<{result: any, mapAgentIDtoTournamentID: Map<Agent.ID, Tournament.ID>}> = [];

  constructor(
    design: Design,
    files: Array<string> | Array<{file: string, name:string, existingID?: string}>, 
    tournamentConfigs: Tournament.TournamentConfigsBase,
    id: NanoID,
    dimension: Dimension
  ) {
    super(design, files, id, tournamentConfigs, dimension);
    this.configs = deepMerge(this.configs, tournamentConfigs, true);

    switch(this.configs.rankSystem) {
      case RankSystem.TRUESKILL:
        
        if (this.configs.rankSystemConfigs === null) {
          // set default rank system configs
          let trueskillConfigs: RankSystem.TRUESKILL.Configs = {
            initialMu: 25,
            initialSigma: 25/3
          }
          this.configs.rankSystemConfigs = trueskillConfigs;
          
        }
        break;
      case RankSystem.ELO:
        
        if (this.configs.rankSystemConfigs === null) {
          // set default rank system configs
          let eloConfigs: RankSystem.ELO.Configs = {
            startingScore: 1000,
            kFactor: 32
          }
          this.configs.rankSystemConfigs = eloConfigs
        }
        this.elo = new ELOSystem(this.configs.rankSystemConfigs.kFactor, this.configs.rankSystemConfigs.startingScore)
        break;
      default:
        throw new NotSupportedError('We currently do not support this rank system for ladder tournaments');
    }

    files.forEach((file) => {
      if (typeof file === 'string') {
        this.initialAddPlayerPromises.push(this.addplayer(file));
      }
      else {
        this.initialAddPlayerPromises.push(this.addplayer(file, file.existingID));
      }
    });
    if (this.configs.addDatabasePlayers) {
      this.initialAddPlayerPromises.push(this.addExistingDatabasePlayers());
    }

    this.status = TournamentStatus.INITIALIZED;
    this.log.info('Initialized Ladder Tournament');
  }
  public getConfigs(): Tournament.TournamentConfigs<LadderConfigs> {
    return this.configs;
  }
  public setConfigs(configs: DeepPartial<Tournament.TournamentConfigs<LadderConfigs>> = {}) {
    this.configs = deepMerge(this.configs, configs, true);
  }
  public getRankings(): Array<{player: Player, name: string, id: number, matchesPlayed: number, rankState: any}> {
    let rankings = [];
    switch(this.configs.rankSystem) {
      case RankSystem.TRUESKILL:
        this.state.playerStats.forEach((stat) => {
          let rankState = <RankSystem.TRUESKILL.RankState>stat.rankState;

          rankings.push({
            player: stat.player,
            name: stat.player.tournamentID.name,
            id: stat.player.tournamentID.id,
            matchesPlayed: stat.matchesPlayed,
            rankState: {rating: {...rankState.rating, mu: rankState.rating.mu, sigma: rankState.rating.sigma}, score: rankState.rating.mu - 3 * rankState.rating.sigma}
          });
        });
        rankings.sort((a, b) => {
          return b.rankState.score - a.rankState.score
        });
        break;
      case RankSystem.ELO:
        this.state.playerStats.forEach((stat) => {
          let rankState = <RankSystem.ELO.RankState>stat.rankState;
          rankings.push({
            player: stat.player,
            name: stat.player.tournamentID.name,
            id: stat.player.tournamentID.id,
            matchesPlayed: stat.matchesPlayed,
            rankState: rankState
          });
        });
        rankings.sort((a, b) => {
          return b.rankState.rating.score - a.rankState.rating.score
        });
        break;
    }
    return rankings;
  }

  /**
   * Stops the tournament if it was running.
   */
  public async stop() {
    if (this.status !== TournamentStatus.RUNNING) {
      throw new TournamentError(`Can't stop a tournament that isn't running`);
    }
    this.log.info('Stopping Tournament...');
    this.status = TournamentStatus.STOPPED;
  }
  
  /**
   * Resumes the tournament if it was stopped.
   */
  public async resume() {
    if (this.status !== TournamentStatus.STOPPED) {
      throw new TournamentError(`Can't resume a tournament that isn't stopped`);
    }
    this.log.info('Resuming Tournament...');
    this.status = TournamentStatus.RUNNING;
    this.tourneyRunner();
  }

  /**
   * Begin the tournament. Resolves once the tournament is started
   * @param configs - tournament configurations to use
   */
  public async run(configs?: DeepPartial<Tournament.TournamentConfigs<LadderConfigs>>) {
    
    this.log.info('Running Tournament');
    this.configs = deepMerge(this.configs, configs, true);
    await this.initialize();
    this.schedule();
    this.status = TournamentStatus.RUNNING;
    this.tourneyRunner();
  }

  private tourneyRunner() {
    let maxTotalMatches = this.configs.tournamentConfigs.maxTotalMatches;
    if (this.configs.tournamentConfigs.endDate) { 
      let currDate = new Date();
      if (currDate.getTime() > this.configs.tournamentConfigs.endDate.getTime()) {
        this.log.info('Reached past Tournament marked End Date, shutting down tournament and returning final results')
        // stop the tournament
        this.stop();
        return;
      }
    }
    if (maxTotalMatches) {
      if (this.state.statistics.totalMatches >= maxTotalMatches) {
        this.stop();
        return;
      }
    }
    let matchPromises = [];

    // if too little matches, schedule another set
    if (this.matchQueue.length < this.configs.tournamentConfigs.maxConcurrentMatches * 2) {
      this.schedule();
    }
    // run as the minimum of the queued matches length, minimum to not go over maxConcurrent matches config, and not to go over a maxtTotalMatches limit if there is one
    for (let i = 0; i < Math.min(this.matchQueue.length, this.configs.tournamentConfigs.maxConcurrentMatches - this.matches.size); i++) {
      if (maxTotalMatches && maxTotalMatches - this.state.statistics.totalMatches - this.matches.size <= 0) {
        break;
      }
      let matchInfo = this.matchQueue.shift();
      matchPromises.push(this.handleMatch(matchInfo));
    }

    // as soon as one match finished, call it again
    Promise.race(matchPromises).then(() => {
      if (this.status == TournamentStatus.RUNNING) {
        this.tourneyRunner();
      }
    }).catch((error) => {
      this.log.error(error);
      if (error instanceof MatchDestroyedError) {
        // keep running even if a match is destroyed and the tournament is marked as to keep running
        if (this.status == TournamentStatus.RUNNING) {
          this.tourneyRunner();
        }
      }
    });
  }

  /**
   * Updates database with trueskill player stats
   * Requires special handling because of the way the trueskill module works
   * 
   * If failure occurs, we ignore it and just log it as we will likely in the future perform an update operation
   * on the database again anyway
   * 
   * @param playerStat 
   * @param user 
   */
  private async updateDatabaseTrueskillPlayerStats(playerStat: LadderPlayerStat, user?: Database.User) {
    let player = playerStat.player;
    if (!player.anonymous) {
      let safeName = this.getSafeName();
      let update = {
        statistics: {}
      }

      // if there exists stats already, keep them
      if (user && user.statistics) {
        update.statistics = user.statistics;
      }

      // perform update
      update.statistics[safeName] = playerStat;
      let rankStateRating = update.statistics[safeName].rankState.rating;

      // make sure to store mu and sigma
      update.statistics[safeName].rankState = {
        rating: {...rankStateRating, mu: rankStateRating.mu, sigma: rankStateRating.sigma}
      }
      try {
        await this.dimension.databasePlugin.updateUser(player.tournamentID.id, update)
      }
      catch(err) {
        this.log.error(`Failed to update user with player stats`, err);
      }
    }
  }
  
  /**
   * Initialize trueskill player stats. Pulls data from database if it exists and uses past stats to fill in
   * @param player 
   * 
   * This is probably a nightmare to test
   */
  private async initializeTrueskillPlayerStats(player: Player) {
    let trueskillConfigs: RankSystem.TRUESKILL.Configs = this.configs.rankSystemConfigs;

    let playerStat: any = null;

    // get any existing rating data
    let user: Database.User;
    let safeName = this.getSafeName();
    if (!player.anonymous && this.dimension.hasDatabase()) {
      user = await this.dimension.databasePlugin.getUser(player.tournamentID.id);
      if (user) {

        // if there are stats
        if (user.statistics) {
          playerStat = user.statistics[safeName];

          // if there was a player stat stored before, fix up rankState to have the toJSON function
          if (playerStat) {
            playerStat.rankState = {
              rating: new Rating(playerStat.rankState.rating.mu, playerStat.rankState.rating.sigma),
              toJSON: () => {
                let rating = this.state.playerStats.get(player.tournamentID.id).rankState.rating
                return {
                  rating: {...rating,
                    mu: rating.mu,
                    sigma: rating.sigma
                  }
                }
              }
            }
          }
        }
      }
    }

    // Initialize to default values
    if (!playerStat) {
      playerStat = {
        player: player,
        wins: 0,
        ties: 0,
        losses: 0,
        matchesPlayed: 0,
        rankState: {
          rating: new Rating(trueskillConfigs.initialMu, trueskillConfigs.initialSigma),
          toJSON: () => {
            let rating = this.state.playerStats.get(player.tournamentID.id).rankState.rating
            return {
              rating: {...rating,
                mu: rating.mu,
                sigma: rating.sigma
              }
            }
          }
        }
      }
      this.updateDatabaseTrueskillPlayerStats(playerStat, user);
    }

    this.state.playerStats.set(player.tournamentID.id, playerStat);
  }

  private async initializeELOPlayerStats(player: Player) {
    let playerStat: any = null;

    // get any existing rating data
    let user: Database.User;
    if (!player.anonymous && this.dimension.hasDatabase()) {
      user = await this.dimension.databasePlugin.getUser(player.tournamentID.id);
      if (user) {
        if (user.statistics) {
          playerStat = user.statistics[`${this.getSafeName()}`];
        }
      }
    }

    // Initialize to default values
    if (!playerStat) {
      playerStat = {
        player: player,
        wins: 0,
        ties: 0,
        losses: 0,
        matchesPlayed: 0,
        rankState: {
          rating: this.elo.createRating()
        }
      }
      // store defaults into database
      if (!player.anonymous && this.dimension.hasDatabase()) {
        let update = {
          statistics: user ? user.statistics : {}
        }
        update.statistics[this.getSafeName()] = playerStat;
        await this.dimension.databasePlugin.updateUser(player.tournamentID.id, update)
      }
    }

    this.state.playerStats.set(player.tournamentID.id, playerStat);
  }
  async initialize() {
    
    // wait for all players to add in.
    await Promise.all(this.initialAddPlayerPromises);

    this.state.playerStats = new Map();
    this.state.results = [];
    let promises: Array<Promise<void>> = [];
    switch(this.configs.rankSystem) {
      case RankSystem.TRUESKILL:
        this.competitors.forEach((player) => {
          promises.push(this.initializeTrueskillPlayerStats(player));
        });
        break;
      case RankSystem.ELO:
        this.competitors.forEach((player) => {
          promises.push(this.initializeELOPlayerStats(player));
        });
        break;
    }
    await Promise.all(promises);
    if (this.configs.consoleDisplay) {
      this.printTournamentStatus();
    }
  }
  
  /**
   * Intended Matchmaking Algorithm Heuristics:
   * 1. Pair players with similar scores (sigma - K * mu)
   * 2. Pair similar varianced players (similar mu)
   * For now, we do random pairing
   */
  private schedule() {
    const matchCount = this.configs.tournamentConfigs.maxConcurrentMatches;
    // runs a round of scheduling
    // for every player, we schedule some m matches (TODO: configurable)
    // let rankings = this.getRankings();
    let compArray = Array.from(this.competitors.values());
    for (let i = 0; i < matchCount; i++) {
      let competitorCount = this.selectRandomAgentAmountForMatch();
      let random = this.selectRandomplayersFromArray(compArray, competitorCount);
      this.matchQueue.push([...random]);
    }
  }

  private selectRandomAgentAmountForMatch(): number {
    return this.configs.agentsPerMatch[Math.floor(Math.random() * this.configs.agentsPerMatch.length)];
  }

  // using resovoir sampling to select num distinct randomly
  private selectRandomplayersFromArray(arr: Array<any>, num: number, excludedSet: Set<number> = new Set()) {
    let reservoir = [];
    // put the first num into reservoir
    for (let i = 0; i < num; i++) {
      reservoir.push(arr[i]);
    }
    for (let i = num; i < arr.length; i++) {
      let j = Math.floor(Math.random() * i);
      if (j < num) {
        reservoir[j] = arr[i];
      }
    }
    return reservoir;
  }

  // when adding a new player
  async internalAddPlayer(player: Player) {
    switch(this.configs.rankSystem) {
      case RankSystem.TRUESKILL:
        await this.initializeTrueskillPlayerStats(player);
        break;
      case RankSystem.ELO:
        await this.initializeELOPlayerStats(player);
      break;
    }
  }

  async updatePlayer(player: Player, oldname: string, oldfile: string) {
    let playerStats = this.state.playerStats.get(player.tournamentID.id);
    switch(this.configs.rankSystem) {
      case RankSystem.ELO: {
        let rankSystemConfigs = <RankSystem.ELO.Configs>this.configs.rankSystemConfigs;
        let currState = <RankSystem.ELO.RankState>playerStats.rankState;
        
        // TODO: Give user option to define how to reset score
        currState.rating.score = rankSystemConfigs.startingScore;
        break;
      }
      case RankSystem.TRUESKILL: {
        let rankSystemConfigs = <RankSystem.TRUESKILL.Configs>this.configs.rankSystemConfigs;
        let currState = <RankSystem.TRUESKILL.RankState>playerStats.rankState;
        
        // TODO: Give user option to define how to reset score
        currState.rating = new Rating(rankSystemConfigs.initialMu, rankSystemConfigs.initialSigma)
        break;
      }
    }
    playerStats.player = player;
    playerStats.matchesPlayed = 0;
    playerStats.losses = 0;
    playerStats.wins = 0;
    playerStats.ties = 0;
    let user = await this.dimension.databasePlugin.getUser(player.tournamentID.id);
    await this.updateDatabaseTrueskillPlayerStats(playerStats, user);
  }

  /**
   * Removes player from tournament. Removes from state and stats from database
   * @param playerID 
   */
  async internalRemovePlayer(playerID: nanoid) {
    if (this.state.playerStats.has(playerID)) {
      // let playerStats = this.state.playerStats.get(playerID);
      this.state.playerStats.delete(playerID);
      
      if (this.dimension.hasDatabase()) {
        let user = await this.dimension.databasePlugin.getUser(playerID);
        if (user) {
          let safeName = this.getSafeName();
          let update = {
            statistics: {}
          }
          // if there exists stats already, keep them
          if (user && user.statistics) {
            update.statistics = user.statistics;
          }
          // delete stats for this tournament to remove player
          delete update.statistics[safeName];
          await this.dimension.databasePlugin.updateUser(playerID, update)
        }
      }
    }
    else {
      throw new TournamentPlayerDoesNotExistError(`Could not find player with ID: ${playerID}`);
    }
  }

  private printTournamentStatus() {
    if (this.log.level > Logger.LEVEL.NONE) {
      console.clear();
      console.log(this.log.bar())
      console.log(`Tournament - ID: ${this.id}, Name: ${this.name} | Dimension - ID: ${this.dimension.id}, Name: ${this.dimension.name}\nStatus: ${this.status} | Competitors: ${this.competitors.size} | Rank System: ${this.configs.rankSystem}\n`);
      console.log('Total Matches: ' + this.state.statistics.totalMatches + ' | Matches Queued: '  + this.matchQueue.length);
      let ranks;
      switch(this.configs.rankSystem) {
        case RankSystem.TRUESKILL:
          ranks = this.getRankings();
          console.log(sprintf(
            `%-30s | %-14s | %-15s | %-18s | %-8s`.underline, 'Name', 'ID', 'Score=(μ - 3σ)', 'Mu: μ, Sigma: σ', 'Matches'));
          ranks.forEach((info) => {
            console.log(sprintf(
              `%-30s`.blue+ ` | %-14s | ` + `%-15s`.green + ` | ` + `μ=%-6s, σ=%-6s`.yellow +` | %-8s`, info.player.tournamentID.name, info.player.tournamentID.id, info.rankState.score.toFixed(7), info.rankState.rating.mu.toFixed(3), info.rankState.rating.sigma.toFixed(3), info.matchesPlayed));
          });
          break;
        case RankSystem.ELO:
          ranks = this.getRankings();
          console.log(sprintf(
            `%-30s | %-8s | %-15s | %-8s`.underline, 'Name', 'ID', 'ELO Score', 'Matches'));
          ranks.forEach((info) => {
            console.log(sprintf(
              `%-30s`.blue+ ` | %-8s | ` + `%-15s`.green + ` | %-8s`, info.player.tournamentID.name, info.player.tournamentID.id, info.rankState.rating.score, info.matchesPlayed));
          });
          break;
      }
      
      
    }
  }

  /**
   * Checks whether match can still be run
   */
  private checkMatchIntegrity(matchInfo: Array<Player>) {
    for (let i = 0; i < matchInfo.length; i++) {
      let player = matchInfo[i];
      if (!this.competitors.has(player.tournamentID.id)) {
        return false;
      }
    }
  }

  /**
   * Handles the start and end of a match, and updates state accrding to match results and the given result handler
   * @param matchInfo 
   */
  private async handleMatch(matchInfo: Array<Player>) {

    if (!this.checkMatchIntegrity(matchInfo)) {
      // quit
      this.log.detail('Match queued cannot be run anymore');
      return;
    }

    if (this.configs.consoleDisplay) {
      this.printTournamentStatus();
      console.log();
      console.log('Current Matches: ' + (this.matches.size + 1));
      this.matches.forEach((match) => {
        let names = [];
        match.agents.forEach((agent) => {
          names.push(agent.name);
        });
        console.log(names);
      });
      let names = [];
      matchInfo.forEach((player) => {
        names.push(player.tournamentID.name);
      });
      console.log(names);
    }

    this.log.detail('Running match - Competitors: ', matchInfo.map((player) => {return player.tournamentID.name}));
    
    let matchRes = await this.runMatch(matchInfo);
    // update total matches
    this.state.statistics.totalMatches++;
    // update matches played per player
    matchInfo.map((player) => {
      let oldplayerStat = this.state.playerStats.get(player.tournamentID.id);
      oldplayerStat.matchesPlayed++;
      this.state.playerStats.set(player.tournamentID.id, oldplayerStat);
    })

    let resInfo = this.configs.resultHandler(matchRes.results);
    switch(this.configs.rankSystem) {
      case RankSystem.TRUESKILL:
        // push to result processing queue
        this.resultProcessingQueue.push(
          {result: resInfo, mapAgentIDtoTournamentID: matchRes.match.mapAgentIDtoTournamentID});
        // make a call to handle match with trueskill to process the next result in the processing queue
        this.handleMatchWithTrueSkill();
        break;
      case RankSystem.ELO:
        // push to result processing queue
        this.resultProcessingQueue.push(
          {result: resInfo, mapAgentIDtoTournamentID: matchRes.match.mapAgentIDtoTournamentID});
        this.handleMatchWithELO();
        break;
    }

    // store past results
    if (this.configs.tournamentConfigs.storePastResults) {
      if (!(this.dimension.hasDatabase() && this.dimension.databasePlugin.configs.saveTournamentMatches)) {
        // if we have don't have a database that is set to actively store tournament matches we store locally
        this.state.results.push(matchRes.results);
      }
    }
  }

  private async handleMatchWithTrueSkill() {
    let toProcess = this.resultProcessingQueue.shift();
    let mapAgentIDtoTournamentID = toProcess.mapAgentIDtoTournamentID;
    let result = <RankSystem.TRUESKILL.Results>toProcess.result;
    let playerRatings: Array<Array<Rating>> = [];
    let tourneyIDs: Array<{id: Tournament.ID, stats: any}> = [];
    let ranks: Array<number> = [];
    result.ranks.sort((a, b) => a.rank - b.rank);
    result.ranks.forEach((rank) => {
      let tournamentID = mapAgentIDtoTournamentID.get(rank.agentID);
      let currentplayerStats = this.state.playerStats.get(tournamentID.id);
      let currRankState = <RankSystem.TRUESKILL.RankState>currentplayerStats.rankState;
      playerRatings.push([currRankState.rating]);
      ranks.push(rank.rank);
      tourneyIDs.push({id: tournamentID, stats: currentplayerStats});
    });

    let newRatings = rate(playerRatings, ranks);
    tourneyIDs.forEach((info, i) => {
      let tourneyID = info.id.id;
      let currentStats = info.stats;
      (<RankSystem.TRUESKILL.RankState>currentStats.rankState).rating = newRatings[i][0];
      this.state.playerStats.set(tourneyID, currentStats);
    });
    

    if (this.configs.consoleDisplay) {
      this.printTournamentStatus();
      console.log();
      console.log('Current Matches: ' + (this.matches.size));
      this.matches.forEach((match) => {
        let names = [];
        match.agents.forEach((agent) => {
          names.push(agent.name);
        });
        console.log(names);
      });
    }

    // TODO: Possibly minor race condition here. Might be that this update is outdated and may overwrite much more new 
    // data
    tourneyIDs.forEach((info, i) => {
      let tourneyID = info.id.id;
      let playerStat = this.state.playerStats.get(tourneyID);
      let player = playerStat.player;
      if (!player.anonymous) {
        this.dimension.databasePlugin.getUser(player.tournamentID.id).then((user) => {
          if (user) {
            this.updateDatabaseTrueskillPlayerStats(playerStat, user);
          }
        }).catch((err: Error) => {
          // don't stop tourney if this happens
          this.log.error(`Issue with using database`, err.message);
        });
      }
      
    });
    
  }

  private async handleMatchWithELO() {
    let toProcess = this.resultProcessingQueue.shift();
    let mapAgentIDtoTournamentID = toProcess.mapAgentIDtoTournamentID;
    let result = <RankSystem.ELO.Results>toProcess.result;
    let ratingsToChange: Array<ELORating> = [];
    let ranks = [];
    result.ranks.forEach((rankInfo) => {
      let tournamentID = mapAgentIDtoTournamentID.get(rankInfo.agentID);
      let currentplayerStats = this.state.playerStats.get(tournamentID.id);
      let currRankState = <RankSystem.ELO.RankState>currentplayerStats.rankState;
      ratingsToChange.push(currRankState.rating);
      ranks.push(rankInfo.rank);
    })

    // re adjust rankings
    this.elo.rate(ratingsToChange, ranks);

    if (this.configs.consoleDisplay) {
      this.printTournamentStatus();
      console.log();
      console.log('Current Matches: ' + (this.matches.size));
      this.matches.forEach((match) => {
        let names = [];
        match.agents.forEach((agent) => {
          names.push(agent.name);
        });
        console.log(names);
      });
    }

  }
}

/**
 * The Ladder Tournament namespace
 */
export namespace Ladder {
  
  /**
   * Configuration interface for {@link LadderTournament}.
   */
  export interface Configs extends Tournament.TournamentTypeConfig {
    /** Max matches that can run concurrently on one node instance 
     * @default 1
     */
    maxConcurrentMatches: number 
    /** The date to stop running this tournament once it is started. If null, no end date 
     * @default null
     */
    endDate: Date
    /** The max matches to run before stopping the tournament. If null, then no maximum
     * @default null
     */
    maxTotalMatches: number 
  }
  /**
   * The {@link LadderTournament} state, consisting of the current player statistics and past results
   */
  export interface State extends Tournament.TournamentTypeState {
    /**
     * A map from a {@link Player} Tournament ID string to statistics
     */
    playerStats: Map<NanoID, PlayerStat>
    
    /**
     * Stats for this Tournament in this instance. Intended to be constant memory usage
     */
    statistics: {
      totalMatches: number
    }
    currentRanks: Array<{player: Player, rankState: any}>
    /**
     * Past results stored. Each element is what is returned by {@link Design.getResults}
     */
    results: Array<any>
  }
  /**
   * Player stat interface for ladder tournaments
   */
  export interface PlayerStat {
    player: Player, 
    wins: number, 
    ties: number, 
    losses: number, 
    matchesPlayed: number, 
    rankState: any
  }
}