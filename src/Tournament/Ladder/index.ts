import { Tournament, Player } from "..";
import { DeepPartial } from "../../utils/DeepPartial";
import { Design } from '../../Design';
import { deepMerge } from "../../utils/DeepMerge";
import { MatchDestroyedError, TournamentError, NotSupportedError, TournamentPlayerDoesNotExistError, AgentFileError } from "../../DimensionError";
import { Agent } from "../../Agent";
import { Rating, rate, quality, TrueSkill } from "ts-trueskill";
import { sprintf } from 'sprintf-js';
import { Logger } from "../../Logger";
import { ELOSystem, ELORating } from "../ELO";
import { Match } from "../../Match";
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
    tournamentConfigs: {
      maxConcurrentMatches: 1,
      endDate: null,
      storePastResults: true,
      maxTotalMatches: null,
      matchMake: null
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
   * Set of player IDs of players to remove
   */
  private playersToRemove: Set<nanoid> = new Set();

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

    this.status = TournamentStatus.INITIALIZED;

    this.log.info('Initialized Ladder Tournament');
  }
  public getConfigs(): Tournament.TournamentConfigs<LadderConfigs> {
    return this.configs;
  }
  public setConfigs(configs: DeepPartial<Tournament.TournamentConfigs<LadderConfigs>> = {}) {
    this.configs = deepMerge(this.configs, configs, true);
  }
  public async getRankings(offset: number = 0, limit: number = -1): Promise<Array<LadderPlayerStat>> {
    let rankings = [];
    switch(this.configs.rankSystem) {
      case RankSystem.TRUESKILL:
        if (this.dimension.hasDatabase()) {
          rankings = await this.dimension.databasePlugin.getRanks(this, offset, limit);
          rankings = rankings.map((rank) => {
            rank.rankState.score = rank.rankState.rating.mu - 3 * rank.rankState.rating.sigma
            return rank;
          });
          if (this.anonymousCompetitors.size > 0) {
            // add in anonymous competitors in
            this.anonymousCompetitors.forEach((player) => {
              let stat = this.state.playerStats.get(player.tournamentID.id);
              let rankState = <RankSystem.TRUESKILL.RankState>stat.rankState;
    
              rankings.push({
                player: stat.player,
                name: stat.player.tournamentID.name,
                id: stat.player.tournamentID.id,
                matchesPlayed: stat.matchesPlayed,
                rankState: {rating: {...rankState.rating, mu: rankState.rating.mu, sigma: rankState.rating.sigma}, score: rankState.rating.mu - 3 * rankState.rating.sigma}
              });
            });
            // re sort
            rankings.sort((a, b) => {
              return b.rankState.score - a.rankState.score
            });
          }
          break;
        }
        else {
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
        }
        rankings.sort((a, b) => {
          return b.rankState.score - a.rankState.score
        });
        break;
      case RankSystem.ELO:
        if (this.dimension.hasDatabase()) {
          rankings = await this.dimension.databasePlugin.getRanks(this, offset, limit);
          if (this.anonymousCompetitors.size > 0) {
            // add in anonymous competitors in
            this.anonymousCompetitors.forEach((player) => {
              let stat = this.state.playerStats.get(player.tournamentID.id);
              let rankState = <RankSystem.TRUESKILL.RankState>stat.rankState;
    
              rankings.push({
                player: stat.player,
                name: stat.player.tournamentID.name,
                id: stat.player.tournamentID.id,
                matchesPlayed: stat.matchesPlayed,
                rankState: rankState
              });
            });
            // re sort
            rankings.sort((a, b) => {
              return b.rankState.rating.score - a.rankState.rating.score
            });
          }
          break;
        }
        else {
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
        }
        rankings.sort((a, b) => {
          return b.rankState.rating.score - a.rankState.rating.score
        });
        break;
    }
    return rankings;
  }

  /**
   * Resets rankings of all competitors loaded to initial scores
   */
  public async resetRankings() {
    if (this.status == TournamentStatus.RUNNING) {
      throw new TournamentError('Cannot reset while tournament is running!');
    }
    let updatePromises: Array<Promise<void>> = [];

    let playerStatsList: Array<Ladder.PlayerStat> = [];
    let userList: Array<Database.User> = [];
    if (this.dimension.hasDatabase()) {
      // get every user
      userList = (await this.dimension.databasePlugin.getUsersInTournament(this.getKeyName(), 0, -1));
      playerStatsList = userList.map((user) => user.statistics[this.getKeyName()]);
      
      // add anonymous users
      playerStatsList.push(...(Array.from(this.state.playerStats.values())));
    }
    else {
      playerStatsList = Array.from(this.state.playerStats.values());
    }

    playerStatsList.forEach((stats, i) => {
      const resetPlayer = async () => {
        switch (this.configs.rankSystem) {
          case RankSystem.TRUESKILL:
            stats.matchesPlayed = 0;
            let trueskillConfigs: RankSystem.TRUESKILL.Configs = this.configs.rankSystemConfigs;

            (<RankSystem.TRUESKILL.RankState>stats.rankState) = {
              rating: new Rating(trueskillConfigs.initialMu, trueskillConfigs.initialSigma)
            }
            if (this.dimension.hasDatabase()) {
              this.updateDatabaseTrueskillPlayerStats(stats, userList[i]);
            }
            break;
          case RankSystem.ELO:
            stats.matchesPlayed = 0;
            stats.rankState = {
              rating: this.elo.createRating()
            }
            if (this.dimension.hasDatabase()) {
              this.updateDatabaseELOPlayerStats(stats, userList[i]);
            }
            break;
        }
        
      }
      updatePromises.push(resetPlayer());
    });
    await Promise.all(updatePromises);
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
    await this.schedule();
    this.status = TournamentStatus.RUNNING;
    this.tourneyRunner();
  }

  private async tourneyRunner() {

    let maxTotalMatches = this.configs.tournamentConfigs.maxTotalMatches;
    if (this.configs.tournamentConfigs.endDate) { 
      let currDate = new Date();
      if (currDate.getTime() > this.configs.tournamentConfigs.endDate.getTime()) {
        this.log.info('Reached past Tournament marked End Date, shutting down tournament...')
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
      await this.schedule();
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
      else {
        if (this.status == TournamentStatus.RUNNING) {
          this.tourneyRunner();
        }
      }
    });
  }

  /**
   * Performs a Fisher Yates Shuffle
   * @param arr - the array to shuffle
   */
  private shuffle(arr: any[]) {
    for (let i = arr.length - 1; i >= 1; i--) {
      let j = Math.floor(Math.random() * i);
      let tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
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
      let keyName = this.getKeyName();
      let update = {
        statistics: {}
      }

      // if there exists stats already, keep them
      if (user && user.statistics) {
        update.statistics = user.statistics;
      }

      // perform update
      update.statistics[keyName] = playerStat;
      let rankStateRating = update.statistics[keyName].rankState.rating;

      // make sure to store mu and sigma
      update.statistics[keyName].rankState = {
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
   * Updates database with ELO player stats
   * 
   * If failure occurs, we ignore it and just log it as we will likely in the future perform an update operation
   * on the database again anyway
   * 
   * @param playerStat 
   * @param user 
   */
  private async updateDatabaseELOPlayerStats(playerStat: LadderPlayerStat, user?: Database.User) {
    let player = playerStat.player;
    if (!player.anonymous) {
      let keyName = this.getKeyName();
      let update = {
        statistics: {}
      }

      // if there exists stats already, keep them
      if (user && user.statistics) {
        update.statistics = user.statistics;
      }

      // perform update
      update.statistics[keyName] = playerStat;

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
    let keyName = this.getKeyName();
    if (!player.anonymous && this.dimension.hasDatabase()) {
      user = await this.dimension.databasePlugin.getUser(player.tournamentID.id);
      if (user) {

        // if there are stats
        if (user.statistics) {
          playerStat = user.statistics[keyName];
          if (playerStat) {
            playerStat.rankState = {
              rating: new Rating(playerStat.rankState.rating.mu, playerStat.rankState.rating.sigma)
            }
            // make sure its referenced to right player object still
            playerStat.player = player;
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
          rating: new Rating(trueskillConfigs.initialMu, trueskillConfigs.initialSigma)
        }
      }
      this.updateDatabaseTrueskillPlayerStats(playerStat, user);
    }

    // only store locally if not in DB
    if (!user) {
      this.state.playerStats.set(player.tournamentID.id, playerStat);
    }
  }

  private async initializeELOPlayerStats(player: Player) {
    let playerStat: any = null;

    // get any existing rating data
    let user: Database.User;
    if (!player.anonymous && this.dimension.hasDatabase()) {
      user = await this.dimension.databasePlugin.getUser(player.tournamentID.id);
      if (user) {
        if (user.statistics) {
          playerStat = user.statistics[`${this.getKeyName()}`];
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
        update.statistics[this.getKeyName()] = playerStat;
        await this.dimension.databasePlugin.updateUser(player.tournamentID.id, update)
      }
    }

    // only store locally if not in DB
    if (!user) {
      this.state.playerStats.set(player.tournamentID.id, playerStat);
    }
  }

  /**
   * Initialize competition with local competitors given and store player stats locally
   * 
   * Does not read in any DB players
   */
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
      await this.printTournamentStatus();
    }
  }
  
  /**
   * Schedules matches to play. Default function is to schedule randomly a player A with other players that are within
   * 2.5 * competitorCount rank of that player A's rank. competitorCount is the number of agents chosen to compete
   * in the particular match to schedule. See {@link Tournament.TournamentConfigs.agentsPerMatch}.
   * 
   * If a {@link Ladder.Configs.matchMake | matchMake} function is provided, that will be used instead of the default.
   */
  private async schedule() {
    // TODO: Slide window instead for dealing with rankings. good buffer size might be max 1k players ~ 10mb
    let rankings = await this.getRankings(0, -1);
    if (this.configs.tournamentConfigs.matchMake) {
      let newMatches = this.configs.tournamentConfigs.matchMake(rankings);
      this.matchQueue.push(...newMatches);
      return;
    }

    // runs a round of scheduling
    // for every player, we schedule a match
    // TODO: For scalability, getrankings should handle just a subset at a time in order to not load too much at once.
    
    let sortedPlayers = rankings.map((p) => p.player);
    let newQueue = [];
    rankings.forEach((playerStat, rank) => {
      let player = playerStat.player;
      let competitorCount = this.selectRandomAgentAmountForMatch();
       
      // take random competitors from +/- competitorCount * 2.5 ranks near you
      let lowerBound = 0;
      if (rank == 0) lowerBound = 1;
      let randomPlayers = this.selectRandomplayersFromArray(
        [...sortedPlayers.slice(Math.max(rank - competitorCount * 2.5, lowerBound), rank), ... sortedPlayers.slice(rank + 1, rank + competitorCount * 2.5)], competitorCount - 1);
      newQueue.push(this.shuffle([player, ...randomPlayers]));
    });
    this.shuffle(newQueue);
    this.matchQueue.push(...newQueue);
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

  // should be called only for DB users
  async updatePlayer(player: Player, oldname: string, oldfile: string) {
    let { user, playerStat } = await this.getPlayerStat(player.tournamentID.id);
    let playerStats = <Ladder.PlayerStat>playerStat
    playerStats.player = player;
    playerStats.matchesPlayed = 0;
    playerStats.losses = 0;
    playerStats.wins = 0;
    playerStats.ties = 0;
    switch(this.configs.rankSystem) {
      case RankSystem.ELO: {
        let rankSystemConfigs = <RankSystem.ELO.Configs>this.configs.rankSystemConfigs;
        let currState = <RankSystem.ELO.RankState>playerStats.rankState;
        
        // TODO: Give user option to define how to reset score
        currState.rating.score = rankSystemConfigs.startingScore;
        if (this.dimension.hasDatabase()) {
          if (!player.anonymous) {
            await this.updateDatabaseELOPlayerStats(playerStats, user);
          }
        }
        break;
      }
      case RankSystem.TRUESKILL: {
        let rankSystemConfigs = <RankSystem.TRUESKILL.Configs>this.configs.rankSystemConfigs;
        let currState = <RankSystem.TRUESKILL.RankState>playerStats.rankState;

        // TODO: Give user option to define how to reset score
        currState.rating = new Rating(currState.rating.mu, rankSystemConfigs.initialSigma)
        if (this.dimension.hasDatabase()) {
          if (!player.anonymous) {
            await this.updateDatabaseTrueskillPlayerStats(playerStats, user);
          }
        }
        break;
      }
    }
    
    
  }

  /**
   * Removes all players in {@link this.playersToRemove} when player is no longer in an active match
   */
  private async removePlayersSafely() {
    this.playersToRemove.forEach((playerID) => {
      // let player = await this.getPlayerStat(playerID)
      // if (player.activeMatchCount === 0) {
        try {
          this._internalRemovePlayer(playerID);
          this.playersToRemove.delete(playerID);
        }
        catch(err) {
          this.log.error('could not find player with ID: ' + playerID);
        }
      // }
    });
  }
  /**
   * Removes player from tournament. Removes from state and stats from database
   * @param playerID 
   */
  async internalRemovePlayer(playerID: nanoid) {
    // TODO: we sometimes do a redudant call to get player stats when we really just need to check for existence
    let { user, playerStat } = (await this.getPlayerStat(playerID));
    if (playerStat) {
      
      // this.playersToRemove.add(playerID);
      // this.removePlayersSafely();
      this.state.playerStats.delete(playerID);
      this.log.info('Removed player ' + playerID);
      if (this.dimension.hasDatabase()) {
        if (user) {
          let keyName = this.getKeyName();
          let update = {
            statistics: {}
          }
          // if there exists stats already, keep them
          if (user && user.statistics) {
            update.statistics = user.statistics;
          }
          // delete stats for this tournament to remove player
          delete update.statistics[keyName];
          await this.dimension.databasePlugin.updateUser(playerID, update);
          this.log.info('Removed player ' + playerID + ' from DB');
        }
      }
    }
    else {
      throw new TournamentPlayerDoesNotExistError(`Could not find player with ID: ${playerID}`);
    }
  }
  /**
   * 
   * @param playerID 
   */
  private async _internalRemovePlayer(playerID: nanoid) {
    let stat = this.getPlayerStat(playerID);
    if (stat) {
      this.state.playerStats.delete(playerID);
      this.log.info('Removed player ' + playerID);
      if (this.dimension.hasDatabase()) {
        let user = await this.dimension.databasePlugin.getUser(playerID);
        if (user) {
          let keyName = this.getKeyName();
          let update = {
            statistics: {}
          }
          // if there exists stats already, keep them
          if (user && user.statistics) {
            update.statistics = user.statistics;
          }
          // delete stats for this tournament to remove player
          delete update.statistics[keyName];
          await this.dimension.databasePlugin.updateUser(playerID, update);
          this.log.info('Removed player ' + playerID + ' from DB');
        }
      }
    }
    else {
      throw new TournamentPlayerDoesNotExistError(`Could not find player with ID: ${playerID}`);
    }
  }

  private async printTournamentStatus() {
    if (this.log.level > Logger.LEVEL.NONE) {
      let ranks: Array<LadderPlayerStat> = await this.getRankings(0, -1);

      console.clear();
      console.log(this.log.bar())
      console.log(`Tournament - ID: ${this.id}, Name: ${this.name} | Dimension - ID: ${this.dimension.id}, Name: ${this.dimension.name}\nStatus: ${this.status} | Competitors: ${this.competitors.size} | Rank System: ${this.configs.rankSystem}\n`);
      console.log('Total Matches: ' + this.state.statistics.totalMatches + ' | Matches Queued: '  + this.matchQueue.length);
      
      switch(this.configs.rankSystem) {
        case RankSystem.TRUESKILL:
          console.log(sprintf(
            `%-30s | %-14s | %-15s | %-18s | %-8s`.underline, 'Name', 'ID', 'Score=(μ - 3σ)', 'Mu: μ, Sigma: σ', 'Matches'));
          ranks.forEach((info) => {
            console.log(sprintf(
              `%-30s`.blue+ ` | %-14s | ` + `%-15s`.green + ` | ` + `μ=%-6s, σ=%-6s`.yellow +` | %-8s`, info.player.tournamentID.name, info.player.tournamentID.id, (info.rankState.rating.mu - info.rankState.rating.sigma * 3).toFixed(7), info.rankState.rating.mu.toFixed(3), info.rankState.rating.sigma.toFixed(3), info.matchesPlayed));
          });
          break;
        case RankSystem.ELO:
          console.log(sprintf(
            `%-30s | %-8s | %-15s | %-8s`.underline, 'Name', 'ID', 'ELO Score', 'Matches'));
          ranks.forEach((info) => {
            console.log(sprintf(
              `%-30s`.blue+ ` | %-8s | ` + `%-15s`.green + ` | %-8s`, info.player.tournamentID.name, info.player.tournamentID.id, info.rankState.rating.score, info.matchesPlayed));
          });
          break;
      }
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

  /**
   * Checks whether match can still be run
   */
  private async checkMatchIntegrity(matchInfo: Array<Player>) {
    const checkIntegrity = async (id: nanoid) => {
      let stat = await this.getPlayerStat(id);
      if (!stat.playerStat) {
        return false;
      }
      else if (stat.playerStat.player.disabled) {
        return false;
      }
      return true;
    }
    let promises: Array<Promise<boolean>> = [];
    for (let i = 0; i < matchInfo.length; i++) {
      let player = matchInfo[i];
      
      promises.push(checkIntegrity(player.tournamentID.id));
    }
    return Promise.all(promises).then((integritys) => {
      for (let i = 0; i < integritys.length; i++) {
        if (integritys[i] === false) return false;
      }
      return true;
    });
  }

  /**
   * Change match counts of all players
   */
  private changeMatchCounts(matchInfo: Array<Player>, amount: number) {
    for (let i = 0; i < matchInfo.length; i++) {
      let playerStat = this.state.playerStats.get(matchInfo[i].tournamentID.id);
      if (!playerStat) {
        // undo changes
        this.changeMatchCounts(matchInfo.slice(0, i), -amount);
        return false;
      }
      playerStat.player.activeMatchCount += amount;
    }
  }

  /**
   * Handles the start and end of a match, and updates state accrding to match results and the given result handler
   * @param matchInfo 
   */
  private async handleMatch(matchInfo: Array<Player>) {
    
    matchInfo.forEach((player) => {
      player.activeMatchCount++;
    });

    if (!(await this.checkMatchIntegrity(matchInfo))) {
      // quit
      this.log.detail('Match queued cannot be run anymore');
      matchInfo.forEach((player) => {
        player.activeMatchCount--;
      });
      return;
    }
    
    if (this.configs.consoleDisplay) {
      await this.printTournamentStatus();
    }

    this.log.detail('Running match - Competitors: ', matchInfo.map((player) => {return player.tournamentID.name}));
    let matchRes: {results: any, match: Match, err?: any};
    matchRes = await this.runMatch(matchInfo);
    if (matchRes.err) {
      this.log.error(`Match ${matchRes.match.id} couldn't run, aborting...`, matchRes.err);
      matchInfo.forEach((player) => {
        player.activeMatchCount--;
      });
      this.removePlayersSafely();
      // remove the match from the active matches list
      this.matches.delete(matchRes.match.id);
      return;
    }

    // update total matches
    this.state.statistics.totalMatches++;

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
    matchInfo.forEach((player) => {
      player.activeMatchCount--;
    });
    /**
     * Remove players as needed
     */
    this.removePlayersSafely();
  }

  /**
   * Update player stats for whoever stats owns this. Determined by checking the player field of 
   * {@link Ladder.PlayerStat}
   */
  private async updatePlayerStat(currentStats: Ladder.PlayerStat) {
    // store locally if not in db
    if (currentStats.player.anonymous) {
      this.state.playerStats.set(currentStats.player.tournamentID.id, currentStats);
    }
    else {
      try {
        let user = await this.dimension.databasePlugin.getUser(currentStats.player.tournamentID.id)
        // if user is still in tourney, update it
        if (user && user.statistics[this.getKeyName()]) {
          switch(this.configs.rankSystem) {
            case RankSystem.TRUESKILL:
              this.updateDatabaseTrueskillPlayerStats(currentStats, user);
              break;
            case RankSystem.ELO:
              this.updateDatabaseELOPlayerStats(currentStats, user);
              break;
          }
        }
      }
      catch (err){
        // don't stop tourney if this happens
        this.log.error(`Issue with using database`, err);
      };
    } 
  }

  /**
   * Handles match results.
   * 
   * If match result is {ranks: []}, nothing will happen, can be used to mark a match as having errored
   */
  private async handleMatchWithTrueSkill() {
    let toProcess = this.resultProcessingQueue.shift();
    let mapAgentIDtoTournamentID = toProcess.mapAgentIDtoTournamentID;
    let result = <RankSystem.TRUESKILL.Results>toProcess.result;
    
    // stop if no ranks provided, meaning match not successful and we throw result away
    if (result.ranks.length === 0) return;
    
    let playerRatings: Array<Array<Rating>> = [];
    let tourneyIDs: Array<{id: Tournament.ID, stats: any}> = [];
    let ranks: Array<number> = [];
    result.ranks.sort((a, b) => a.rank - b.rank);
    
    let fetchingRatings: Array<Promise<void>> = [];
    result.ranks.forEach((rank) => {
      const fetchRating = async () => {
        let tournamentID = mapAgentIDtoTournamentID.get(rank.agentID);
        
        /** 
         * Future TODO: Acquire and release locks on an DB entry. 
         * realistically only matters if DB is slow or many matches run with a player 
         */
        let { playerStat } = (await this.getPlayerStat(tournamentID.id));
        if (!playerStat) {
          throw new TournamentPlayerDoesNotExistError(`Player ${tournamentID.id} doesn't exist anymore, likely was removed`);
        }
        let currentplayerStats = <Ladder.PlayerStat>playerStat;
        currentplayerStats.matchesPlayed++;

        let currRankState = <RankSystem.TRUESKILL.RankState>currentplayerStats.rankState;
        playerRatings.push([currRankState.rating]);
        ranks.push(rank.rank);
        tourneyIDs.push({id: tournamentID, stats: currentplayerStats});
      }
      fetchingRatings.push(fetchRating());
    });
    try {
      await Promise.all(fetchingRatings);
    } catch (err) {
      this.log.error('Probably due to player being removed', err);
      return;
    }

    let newRatings = rate(playerRatings, ranks);
    let updatePlayerStatsPromises: Array<Promise<void>> = [];
    tourneyIDs.forEach((info, i) => {
      const updateStat = async () => {
        let currentStats: Ladder.PlayerStat = info.stats;
        (<RankSystem.TRUESKILL.RankState>currentStats.rankState).rating = newRatings[i][0];

        this.updatePlayerStat(currentStats);
      }
      updatePlayerStatsPromises.push(updateStat());
    });
    
    await Promise.all(updatePlayerStatsPromises);

    if (this.configs.consoleDisplay) {
      await this.printTournamentStatus();
    }
    
  }

  private async handleMatchWithELO() {
    let toProcess = this.resultProcessingQueue.shift();
    let mapAgentIDtoTournamentID = toProcess.mapAgentIDtoTournamentID;
    let result = <RankSystem.ELO.Results>toProcess.result;
    if (result.ranks.length === 0) return;
    let ratingsToChange: Array<ELORating> = [];
    let ranks = [];
    let tourneyIDs: Array<{id: Tournament.ID, stats: any}> = [];
    let fetchingRatings: Array<Promise<void>> = [];
    result.ranks.forEach((rankInfo) => {
      const fetchRating = async () => {
        let tournamentID = mapAgentIDtoTournamentID.get(rankInfo.agentID);

        let { playerStat } = (await this.getPlayerStat(tournamentID.id));
        let currentplayerStats = <Ladder.PlayerStat>playerStat;
        currentplayerStats.matchesPlayed++;
        
        let currRankState = <RankSystem.ELO.RankState>currentplayerStats.rankState;
        ratingsToChange.push(currRankState.rating);
        ranks.push(rankInfo.rank);
        tourneyIDs.push({id: tournamentID, stats: currentplayerStats});
      }
      fetchingRatings.push(fetchRating());
    });

    await Promise.all(fetchingRatings);

    // re adjust rankings
    this.elo.rate(ratingsToChange, ranks);

    

    let updatePlayerStatsPromises: Array<Promise<void>> = [];
    // update database if needed and store play stats
    tourneyIDs.forEach((info, i) => {
      const updateStat = async () => {
        let tourneyID = info.id.id;
        let currentStats = info.stats;
        updatePlayerStatsPromises.push(this.updatePlayerStat(currentStats));
      }
      updatePlayerStatsPromises.push(updateStat());
    });
    await Promise.all(updatePlayerStatsPromises);

    if (this.configs.consoleDisplay) {
      await this.printTournamentStatus();
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

    /**
     * Custom match making scheduler function. User can provide a custom function here to create matches to store
     * into the matchqueue for {@link Match} making. This function will be called every time the number of queued 
     * matches is below a threshold of {@link maxConcurrentMatches} * 2.
     * 
     * It should return an array of {@link Player } arrays, a list of all the new matches to append to the matchQueue. 
     * A player array represents a queued match and the players that will compete in that match. 
     * 
     * 
     * Default function is described in {@link schedule}
     * 
     */
    matchMake: 
    /**
     * @param playerStats - an array of all player stats in the tournament. See {@link PlayerStat} for what variables
     * are exposed to use to help schedule matches
     */
      (playerStats: Array<PlayerStat>) => Array<Array<Player>>
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
  }
  /**
   * Player stat interface for ladder tournaments
   */
  export interface PlayerStat extends Tournament.PlayerStatBase {

    wins: number, 
    ties: number, 
    losses: number, 
    /**
     * total matches played
     */
    matchesPlayed: number, 
    /**
     * the ranking statistics for the player. the type of this variable is dependent on the ranking system you use for
     * the tournament. If the ranking system is {@link RankSystem.TRUESKILL | Trueskill}, then see 
     * {@link RankSystem.TRUESKILL.RankState} for the rank state typings.
     */
    rankState: any
  }
}