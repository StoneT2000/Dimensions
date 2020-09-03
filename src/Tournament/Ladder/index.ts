import { Tournament, Player } from '..';
import { DeepPartial } from '../../utils/DeepPartial';
import { Design } from '../../Design';
import { deepMerge } from '../../utils/DeepMerge';
import {
  MatchDestroyedError,
  TournamentError,
  NotSupportedError,
  TournamentPlayerDoesNotExistError,
  AgentCompileError,
  AgentInstallError,
  FatalError,
} from '../../DimensionError';
import { Agent } from '../../Agent';
import { Logger } from '../../Logger';
import { Dimension, NanoID } from '../../Dimension';
import { Database } from '../../Plugin/Database';
import { TournamentStatus } from '../TournamentStatus';
import { RankSystem } from '../RankSystem';
import { TournamentType } from '../TournamentTypes';
import { TrueSkillSystem } from '../RankSystem/TrueSkillSystem';
import { ELOSystem } from '../RankSystem/ELOSystem';
import LadderState = Ladder.State;
import LadderConfigs = Ladder.Configs;
import LadderPlayerStat = Ladder.PlayerStat;
import { nanoid } from '../..';
import { deepCopy } from '../../utils/DeepCopy';
import { Scheduler } from '../Scheduler';
import { WinsSystem } from '../RankSystem/WinsSystem';

const REFRESH_RATE = 10000;

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
      matchMake: null,
      configSyncRefreshRate: 6000,
      syncConfigs: true,
      selfMatchMake: true,
    },
    resultHandler: null,
    agentsPerMatch: [2],
    consoleDisplay: true,
    id: 'z3plg',
  };
  state: LadderState = {
    playerStats: new Map(),
    currentRanks: [],
    results: [],
    statistics: {
      totalMatches: 0,
    },
  };

  type = Tournament.Type.LADDER;

  // lock matchqueue for concurrency
  private matchQueueLocked = false;

  /**
   * The ranksystem object being used to update, initialize, etc. ranks
   */
  private ranksystem: RankSystem<any, any>;

  /**
   * tournament runner interval, periodically calls tourneyRunner to start up new matches
   */
  private runInterval = null;

  /**
   * Configuration synchronization interval. Periodically makes a request to the DB if there is one and syncs configs
   */
  private configSyncInterval = null;

  /**
   * Last modification date of configs
   */
  private configLastModificationDate = new Date(0);

  // queue of the results to process
  resultProcessingQueue: Array<{
    result: RankSystem.Results;
    mapAgentIDtoTournamentID: Map<Agent.ID, Tournament.ID>;
  }> = [];

  constructor(
    design: Design,
    files:
      | Array<string>
      | Array<{ file: string; name: string; existingID?: string }>,
    tournamentConfigs: Tournament.TournamentConfigsBase,
    id: NanoID,
    dimension: Dimension
  ) {
    super(design, id, tournamentConfigs, dimension);
    this.configs = deepMerge(this.configs, tournamentConfigs, true);

    if (typeof this.configs.rankSystem === 'string') {
      if (this.configs.rankSystemConfigs === null) {
        this.configs.rankSystemConfigs = {};
      }
      switch (this.configs.rankSystem) {
        case Tournament.RankSystemTypes.TRUESKILL:
          this.ranksystem = new TrueSkillSystem(this.configs.rankSystemConfigs);
          break;
        case Tournament.RankSystemTypes.ELO:
          this.ranksystem = new ELOSystem(this.configs.rankSystemConfigs);
          break;
        case Tournament.RankSystemTypes.WINS:
          this.ranksystem = new WinsSystem(this.configs.rankSystemConfigs);
          break;
        default:
          throw new NotSupportedError(
            'We currently do not support this rank system for ladder tournaments'
          );
      }
    } else {
      this.ranksystem = this.configs.rankSystem;
    }
    if (this.ranksystem === null) {
      throw new FatalError('Did not supply a rank system');
    }

    files.forEach((file) => {
      if (typeof file === 'string') {
        this.initialAddPlayerPromises.push(
          this.addplayer(file, undefined, true)
        );
      } else {
        this.initialAddPlayerPromises.push(
          this.addplayer(file, file.existingID, true)
        );
      }
    });

    Promise.all(this.initialAddPlayerPromises).then(() => {
      this.emit(Tournament.Events.INITIAL_PLAYERS_INITIALIZED);
    });

    this.status = TournamentStatus.INITIALIZED;

    // setup config syncing if DB is enabled and store configs if not stored already
    if (this.dimension.hasDatabase()) {
      if (this.configs.tournamentConfigs.syncConfigs) {
        this.syncConfigs();
        this.setupConfigSyncInterval();
        this.dimension.databasePlugin
          .getTournamentConfigs(this.id)
          .then((data) => {
            if (!data) {
              this.configLastModificationDate = new Date();
              // store tournament configs if no configs found
              this.dimension.databasePlugin
                .storeTournamentConfigs(
                  this.id,
                  this.getConfigsStrippedOfFunctionFields(this.configs),
                  this.status
                )
                .then(() => {
                  this.log.info(
                    'Storing initial tournament configuration data'
                  );
                });
            }
          });
      }
    }

    // setup matchmaking algorithm to default if not provided
    if (!this.configs.tournamentConfigs.matchMake) {
      let max = this.configs.agentsPerMatch[0];
      this.configs.agentsPerMatch.forEach((v) => {
        max = Math.max(max, v);
      });
      this.configs.tournamentConfigs.matchMake = Scheduler.RankRangeRandom({
        agentsPerMatch: this.configs.agentsPerMatch,
        range: Math.ceil(max * 2.5),
      });
    }

    this.log.info('Initialized Ladder Tournament');
  }

  private getConfigsStrippedOfFunctionFields(
    object: Tournament.TournamentConfigs<LadderConfigs>
  ) {
    const obj = deepCopy(object);
    delete obj.resultHandler;
    delete obj.rankSystem;
    delete obj.tournamentConfigs.matchMake;
    return obj;
  }

  /**
   * Sync configs from DB
   */
  private async syncConfigs() {
    const modDate = await this.dimension.databasePlugin.getTournamentConfigsModificationDate(
      this.id
    );

    // if modDate exists, and mod date is past the last mode date.
    if (
      modDate &&
      modDate.getTime() > this.configLastModificationDate.getTime()
    ) {
      const {
        configs,
        status,
      } = await this.dimension.databasePlugin.getTournamentConfigs(this.id);
      this.log.info(`Received new configurations, mod date - ${modDate}`);
      this.log.detail(configs);
      this.configLastModificationDate = modDate;
      this.configs = deepMerge(this.configs, configs, true);

      // update status and run/stop/resume tourney as needed
      if (status !== this.status) {
        if (status === Tournament.Status.STOPPED) {
          if (this.status === Tournament.Status.RUNNING) {
            this.stop();
          }
        } else if (status === Tournament.Status.RUNNING) {
          if (this.status === Tournament.Status.INITIALIZED) {
            this.run();
          } else if (this.status === Tournament.Status.STOPPED) {
            this.resume();
          }
        }
      }
    }
  }

  private setupConfigSyncInterval() {
    this.configSyncInterval = setInterval(() => {
      this.syncConfigs();
    }, this.configs.tournamentConfigs.configSyncRefreshRate);
  }

  /**
   * Retrieves the local configurations
   */
  public getConfigs(): Tournament.TournamentConfigs<LadderConfigs> {
    return this.configs;
  }

  /**
   * Set tournament status and updates DB / propagates the message to every other tournament instance
   */
  public async setStatus(status: Tournament.Status): Promise<void> {
    if (
      this.dimension.hasDatabase() &&
      this.configs.tournamentConfigs.syncConfigs
    ) {
      await this.syncConfigs();
      await this.dimension.databasePlugin.storeTournamentConfigs(
        this.id,
        this.configs,
        status
      );
      this.status = status;
    } else {
      this.status = status;
    }
  }
  /**
   * Sets configs and updates DB / propagates the message to every other tournament instance
   */
  public async setConfigs(
    configs: DeepPartial<Tournament.TournamentConfigs<LadderConfigs>> = {}
  ): Promise<void> {
    if (configs.id) {
      throw new TournamentError(
        'You cannot change the tournament ID after constructing the tournament'
      );
    }
    if (configs.rankSystem) {
      throw new TournamentError(
        'You cannot change the rank system after constructing the tournament'
      );
    }

    if (
      this.dimension.hasDatabase() &&
      this.configs.tournamentConfigs.syncConfigs
    ) {
      const plugin = this.dimension.databasePlugin;
      // ensure configs are up to date first, then set configs
      this.syncConfigs().then(() => {
        const newconfigs = deepMerge(deepCopy(this.configs), configs, true);
        plugin
          .storeTournamentConfigs(
            this.id,
            this.getConfigsStrippedOfFunctionFields(newconfigs),
            this.status
          )
          .then(() => {
            // set configs locally as well if we succesfully store into DB
            this.configs = newconfigs;
          });
      });
    } else {
      // if sync off or no database, edit configs in memory
      this.configs = deepMerge(this.configs, configs, true);
    }
  }

  /**
   * Gets all rankings with the given offset from rank 1 and limit. Note this it's not recommended to use this
   * function if there are many users. It is suggested to create your own (aggregation) query to get rankings directly
   * from the DB.
   * @param offset
   * @param limit
   */
  public async getRankings(
    offset = 0,
    limit = -1
  ): Promise<Array<LadderPlayerStat>> {
    let rankings: Array<LadderPlayerStat> = [];
    if (this.dimension.hasDatabase()) {
      const users = await this.dimension.databasePlugin.getUsersInTournament(
        this.getKeyName(),
        0,
        -1
      );
      rankings = users.map((user) => {
        const stat = user.statistics[this.getKeyName()];
        const rankState = stat.rankState;
        return {
          player: stat.player,
          matchesPlayed: stat.matchesPlayed,
          rankState,
        };
      });
      if (this.anonymousCompetitors.size > 0) {
        this.anonymousCompetitors.forEach((player) => {
          const stat = this.state.playerStats.get(player.tournamentID.id);
          const rankState = stat.rankState;
          rankings.push({
            player: stat.player,
            matchesPlayed: stat.matchesPlayed,
            rankState,
          });
        });
      }
    } else {
      this.state.playerStats.forEach((stat) => {
        rankings.push({
          player: stat.player,
          matchesPlayed: stat.matchesPlayed,
          rankState: stat.rankState,
        });
      });
    }

    rankings.sort((a, b) => {
      return this.ranksystem.rankComparator(a.rankState, b.rankState);
    });
    const end = limit === -1 ? rankings.length : offset + limit;
    return rankings.slice(offset, end);
  }

  /**
   * Resets rankings of all competitors loaded to initial scores
   */
  public async resetRankings(): Promise<void> {
    // TODO: Some instances of tournament might still be running once this one is stopped, and reset won't work
    // correctly
    if (this.status == TournamentStatus.RUNNING) {
      throw new TournamentError('Cannot reset while tournament is running!');
    }
    const updatePromises: Array<Promise<void>> = [];

    let playerStatsList: Array<Ladder.PlayerStat> = [];
    let userList: Array<Database.User> = [];
    if (this.dimension.hasDatabase()) {
      // get every user
      userList = await this.dimension.databasePlugin.getUsersInTournament(
        this.getKeyName(),
        0,
        -1
      );
      playerStatsList = userList.map(
        (user) => user.statistics[this.getKeyName()]
      );

      // add anonymous users
      playerStatsList.push(...Array.from(this.state.playerStats.values()));
    } else {
      playerStatsList = Array.from(this.state.playerStats.values());
    }

    playerStatsList.forEach((stats, i) => {
      const resetPlayer = async () => {
        stats.matchesPlayed = 0;
        stats.rankState = this.ranksystem.resetRank(stats.rankState);
        if (this.dimension.hasDatabase()) {
          await this.updateDatabasePlayerStats(stats, userList[i]);
        }
      };
      updatePromises.push(resetPlayer());
    });
    await Promise.all(updatePromises);
  }

  /**
   * Stops the tournament if it was running.
   * @param primary - whether or not the instance calling stop was the first one, the "primary" instance
   */
  public async stop(primary = false): Promise<void> {
    if (this.status !== TournamentStatus.RUNNING) {
      throw new TournamentError(`Can't stop a tournament that isn't running`);
    }
    this.log.info('Stopping Tournament...');
    clearInterval(this.runInterval);
    if (primary) {
      await this.setStatus(TournamentStatus.STOPPED);
    } else {
      this.status = TournamentStatus.STOPPED;
    }
  }

  /**
   * Resumes the tournament if it was stopped.
   * @param primary - whether or not the instance calling stop was the first one, the "primary" instance
   */
  public async resume(primary = false): Promise<void> {
    if (this.status !== TournamentStatus.STOPPED) {
      throw new TournamentError(`Can't resume a tournament that isn't stopped`);
    }
    this.log.info('Resuming Tournament...');
    if (primary) {
      await this.setStatus(TournamentStatus.RUNNING);
    } else {
      this.status = TournamentStatus.RUNNING;
    }
    this.tourneyRunner();
    this.runInterval = setInterval(() => {
      this.tourneyRunner();
    }, REFRESH_RATE);
  }

  /**
   * Begin the tournament. Resolves once the tournament is started
   * @param configs - tournament configurations to use
   * @param master - whether or not the instance calling stop was the first one, the "master" instance
   */
  public async run(
    configs?: DeepPartial<Tournament.TournamentConfigs<LadderConfigs>>,
    master = false
  ): Promise<void> {
    this.log.info('Running Tournament');
    this.configs = deepMerge(this.configs, configs, true);
    await this.initialize();

    this.configs.tournamentConfigs.selfMatchMake
      ? await this.schedule()
      : this.log.info(
          'Self match make turned off, tournament will only run matches stored in match queue'
        );

    if (master) {
      this.setStatus(TournamentStatus.RUNNING);
    } else {
      this.status = TournamentStatus.RUNNING;
    }
    this.tourneyRunner();
    this.runInterval = setInterval(() => {
      this.tourneyRunner();
    }, REFRESH_RATE);
  }

  private async tourneyRunner() {
    if (this.matchQueueLocked) {
      return;
    }
    this.matchQueueLocked = true;
    if (
      this.matches.size >= this.configs.tournamentConfigs.maxConcurrentMatches
    ) {
      this.matchQueueLocked = false;
      return;
    }

    const maxTotalMatches = this.configs.tournamentConfigs.maxTotalMatches;
    if (this.configs.tournamentConfigs.endDate) {
      const currDate = new Date();
      if (
        currDate.getTime() > this.configs.tournamentConfigs.endDate.getTime()
      ) {
        this.log.info(
          'Reached past Tournament marked End Date, shutting down tournament...'
        );
        // stop the tournament
        this.stop();
        return;
      }
    }
    if (maxTotalMatches) {
      if (this.state.statistics.totalMatches >= maxTotalMatches) {
        this.log.info('Reached max matches, shutting down tournament...');
        this.stop();
        this.matchQueueLocked = false;
        return;
      }
    }
    const matchPromises = [];

    // if too little matches, schedule another set provided tournament is set to schedule its own matches
    if (
      this.configs.tournamentConfigs.selfMatchMake &&
      this.matchQueue.length <
        this.configs.tournamentConfigs.maxConcurrentMatches * 2
    ) {
      await this.schedule();
    }

    // run as many matches as allowed by maxConcurrentMatches, maxTotalMatches, and how many matches left in queue allow
    for (
      let i = 0;
      i <
      Math.min(
        this.matchQueue.length,
        this.configs.tournamentConfigs.maxConcurrentMatches - this.matches.size
      );
      i++
    ) {
      if (
        maxTotalMatches &&
        maxTotalMatches -
          this.state.statistics.totalMatches -
          this.matches.size <=
          0
      ) {
        break;
      }
      const matchInfo = this.matchQueue.shift();
      matchPromises.push(this.handleMatch(matchInfo));
    }

    // as soon as one match finished, call it again
    Promise.race(matchPromises)
      .then(() => {
        if (this.status == TournamentStatus.RUNNING) {
          this.tourneyRunner();
        }
      })
      .catch((error) => {
        this.log.error(error);
        if (error instanceof MatchDestroyedError) {
          // keep running even if a match is destroyed and the tournament is marked as to keep running
          if (this.status == TournamentStatus.RUNNING) {
            this.tourneyRunner();
          }
        } else {
          if (this.status == TournamentStatus.RUNNING) {
            this.tourneyRunner();
          }
        }
      });
    this.matchQueueLocked = false;
  }

  /**
   * Updates database with new player stats
   *
   * If failure occurs, we ignore it and just log it as we will likely in the future perform an update operation
   * on the database again anyway
   */
  private async updateDatabasePlayerStats(
    playerStat: LadderPlayerStat,
    user?: Database.User
  ) {
    const player = playerStat.player;
    if (!player.anonymous) {
      const keyName = this.getKeyName();
      const update = {
        statistics: {},
      };

      // if there exists stats already, keep them
      if (user && user.statistics) {
        update.statistics = user.statistics;
      }

      // perform update
      update.statistics[keyName] = playerStat;
      try {
        await this.dimension.databasePlugin.updateUser(
          player.tournamentID.id,
          update
        );
      } catch (err) {
        this.log.error(`Failed to update user with player stats`, err);
      }
    }
  }

  private async initializePlayerStats(player: Player) {
    let playerStat: any = null;

    let user: Database.User;
    const keyName = this.getKeyName();
    if (!player.anonymous && this.dimension.hasDatabase()) {
      user = await this.dimension.databasePlugin.getUser(
        player.tournamentID.id
      );
      if (user) {
        // if there are stats
        if (user.statistics) {
          playerStat = user.statistics[keyName];
          if (playerStat) {
            // if player stats exist already, we can return as we dont need to initialize anything and store to DB
            // we don't store anything locally because this is a user and we have DB
            return;
          }
        }
      }
    }

    // Initialize to default values
    if (!playerStat) {
      playerStat = {
        player: player,
        matchesPlayed: 0,
        rankState: this.ranksystem.initializeRankState(),
      };
      await this.updateDatabasePlayerStats(playerStat, user);
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
  async initialize(): Promise<void> {
    // wait for all players to add in.
    await Promise.all(this.initialAddPlayerPromises);

    this.state.playerStats = new Map();
    this.state.results = [];
    const promises: Array<Promise<void>> = [];
    this.competitors.forEach((player) => {
      promises.push(this.initializePlayerStats(player));
    });
    await Promise.all(promises);
    if (this.configs.consoleDisplay) {
      await this.printTournamentStatus();
    }
  }

  /**
   * Schedules matches to play. By default uses {@link Scheduler.RankRangeRandom}
   *
   * If a {@link Ladder.Configs.matchMake | matchMake} function is provided, that will be used instead of the default.
   *
   * For users who want to host larger scale competitions with 1000+ competitors, its recommended to turn self match
   * make off and setup a separate match scheduling server that tournament servers can pull queued matches from
   */
  private async schedule() {
    const rankings = await this.getRankings(0, -1);
    if (this.configs.tournamentConfigs.matchMake) {
      const newMatches = this.configs.tournamentConfigs.matchMake(rankings);
      this.matchQueue.push(...newMatches);
      return;
    }
  }

  /** Schedule a match using match info */
  public scheduleMatches(...matchInfos: Array<Tournament.QueuedMatch>): void {
    this.matchQueue.push(...matchInfos);
    // kick off the runner to process any matches
    this.tourneyRunner();
  }

  // called adding a new player
  async internalAddPlayer(player: Player): Promise<void> {
    await this.initializePlayerStats(player);
  }

  // should be called only for DB users
  async updatePlayer(player: Player): Promise<void> {
    const { user, playerStat } = await this.getPlayerStat(
      player.tournamentID.id
    );
    const playerStats = <Ladder.PlayerStat>playerStat;
    playerStats.player = player;
    playerStats.matchesPlayed = 0;
    playerStats.rankState = this.ranksystem.onPlayerUpdate(
      playerStats.rankState
    );
    if (this.dimension.hasDatabase()) {
      if (!player.anonymous) {
        await this.updateDatabasePlayerStats(playerStats, user);
      }
    }
  }

  /**
   * Removes player from tournament. Removes from state and stats from database
   * @param playerID
   */
  async internalRemovePlayer(playerID: nanoid): Promise<void> {
    // TODO: we sometimes do a redudant call to get player stats when we really just need to check for existence
    const { user, playerStat } = await this.getPlayerStat(playerID);
    if (playerStat) {
      this.state.playerStats.delete(playerID);
      this.log.info('Removed player ' + playerID);
      if (this.dimension.hasDatabase()) {
        if (user) {
          const keyName = this.getKeyName();
          const update = {
            statistics: {},
          };
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
    } else {
      throw new TournamentPlayerDoesNotExistError(
        `Could not find player with ID: ${playerID}`
      );
    }
  }

  /**
   * Print tournament status to display
   */
  /* istanbul ignore next */
  private async printTournamentStatus() {
    if (this.log.level > Logger.LEVEL.NONE) {
      const ranks: Array<LadderPlayerStat> = await this.getRankings(0, -1);

      console.clear();
      console.log(this.log.bar());
      console.log(
        `Tournament - ID: ${this.id}, Name: ${this.name} | Dimension - ID: ${this.dimension.id}, Name: ${this.dimension.name}\nStatus: ${this.status} | Competitors: ${this.competitors.size} | Rank System: ${this.configs.rankSystem}\n`
      );
      console.log(
        'Total Matches: ' +
          this.state.statistics.totalMatches +
          ' | Matches Queued: ' +
          this.matchQueue.length
      );

      console.log(this.ranksystem.getRankStatesHeaderString());
      ranks.forEach((info) => {
        console.log(
          this.ranksystem.getRankStateString(
            info.player,
            info.rankState,
            info.matchesPlayed
          )
        );
      });
      console.log();
      console.log('Current Matches: ' + this.matches.size);
      this.matches.forEach((match) => {
        const names = [];
        match.agents.forEach((agent) => {
          names.push(agent.name);
        });
        console.log(names);
      });
    }
  }

  /**
   * Checks whether match can still be run
   *
   * If there are no stats, player was removed and match can't be run. If player is disabled, then it won't run
   */
  private async checkMatchIntegrity(matchInfo: Array<Player>) {
    const checkIntegrity = async (id: nanoid) => {
      const stat = await this.getPlayerStat(id);
      if (!stat.playerStat) {
        return false;
      } else if (stat.playerStat.player.disabled) {
        return false;
      }
      return true;
    };
    const promises: Array<Promise<boolean>> = [];
    for (let i = 0; i < matchInfo.length; i++) {
      const player = matchInfo[i];

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
   * Handles the start and end of a match, and updates state accrding to match results and the given result handler
   * @param matchInfo
   */
  private async handleMatch(queuedMatchInfo: Tournament.QueuedMatch) {
    // Consider adding possibility to use cached player meta data
    const matchInfo = await this.getMatchInfoFromQueuedMatch(queuedMatchInfo);

    if (!(await this.checkMatchIntegrity(matchInfo))) {
      // quit
      this.log.detail('Match queued cannot be run anymore');
      return;
    }

    if (this.configs.consoleDisplay) {
      await this.printTournamentStatus();
    }

    this.log.detail(
      'Running match - Competitors: ',
      matchInfo.map((player) => {
        return player.tournamentID.name;
      })
    );
    const matchRes = await this.runMatch(matchInfo);
    if (matchRes.err) {
      if (matchRes.err instanceof AgentCompileError) {
        const tournamentID = matchRes.match.mapAgentIDtoTournamentID.get(
          matchRes.err.agentID
        );
        this.log.warn(
          `Match couldn't run. Player ${tournamentID.id} got a compile error`
        );
        await this.disablePlayer(tournamentID.id);
      } else if (matchRes.err instanceof AgentInstallError) {
        const tournamentID = matchRes.match.mapAgentIDtoTournamentID.get(
          matchRes.err.agentID
        );
        this.log.warn(
          `Match couldn't run. Player ${tournamentID.id} got an install error`
        );
        await this.disablePlayer(tournamentID.id);
      } else {
        this.log.error(`Match couldn't run, aborting... `, matchRes.err);
      }

      // remove the match from the active matches list
      this.matches.delete(matchRes.match.id);
      return;
    }

    // update total matches
    this.state.statistics.totalMatches++;

    const resInfo = this.configs.resultHandler(matchRes.results);
    // push to result processing queue
    this.resultProcessingQueue.push({
      result: resInfo,
      mapAgentIDtoTournamentID: matchRes.match.mapAgentIDtoTournamentID,
    });
    // make a call to handle match with trueskill to process the next result in the processing queue
    this.handleMatchResults();

    // store past results
    if (this.configs.tournamentConfigs.storePastResults) {
      if (
        !(
          this.dimension.hasDatabase() &&
          this.dimension.databasePlugin.configs.saveTournamentMatches
        )
      ) {
        // if we have don't have a database that is set to actively store tournament matches we store locally
        this.state.results.push(matchRes.results);
      }
    }
  }

  /**
   * Update player stats for whoever stats owns this player stat. Determined by checking the player field of
   * {@link Ladder.PlayerStat}
   */
  private async updatePlayerStat(currentStats: Ladder.PlayerStat) {
    // store locally if not in db
    if (currentStats.player.anonymous) {
      this.state.playerStats.set(
        currentStats.player.tournamentID.id,
        currentStats
      );
    } else {
      try {
        const user = await this.dimension.databasePlugin.getUser(
          currentStats.player.tournamentID.id
        );
        // if user is still in tourney, update it
        // TODO: make user.statistics[this.getKeyName()] a function
        if (user && user.statistics[this.getKeyName()]) {
          await this.updateDatabasePlayerStats(currentStats, user);
        }
      } catch (err) {
        // don't stop tourney if this happens
        this.log.error(`Issue with using database`, err);
      }
    }
  }

  private async handleMatchResults() {
    const toProcess = this.resultProcessingQueue.shift();
    const mapAgentIDtoTournamentID = toProcess.mapAgentIDtoTournamentID;
    const result = toProcess.result;

    // stop if no ranks provided, meaning match not successful and we throw result away
    if (result.ranks.length === 0) {
      this.emit(Tournament.Events.MATCH_HANDLED);
      return;
    }
    result.ranks.sort((a, b) => a.rank - b.rank);
    const rankStatePromises: Array<Promise<void>> = [];

    // the following 3 arrays are parallel
    const ranks: Array<number> = [];
    const currentRankStates: Array<any> = [];
    const tourneyIDs: Array<{
      id: Tournament.ID;
      stats: LadderPlayerStat;
    }> = [];
    result.ranks.forEach((rankInfo) => {
      const fetchRankState = async () => {
        const tournamentID = mapAgentIDtoTournamentID.get(rankInfo.agentID);
        const { playerStat } = await this.getPlayerStat(tournamentID.id);
        if (!playerStat) {
          throw new TournamentPlayerDoesNotExistError(
            `Player ${tournamentID.id} doesn't exist anymore, likely was removed`
          );
        }
        const currentplayerStats = <Ladder.PlayerStat>playerStat;
        currentplayerStats.matchesPlayed++;
        ranks.push(rankInfo.rank);
        tourneyIDs.push({ id: tournamentID, stats: currentplayerStats });
        currentRankStates.push(currentplayerStats.rankState);
      };
      rankStatePromises.push(fetchRankState());
    });

    try {
      await Promise.all(rankStatePromises);
    } catch (err) {
      this.log.error('Probably due to player being removed: ', err);
      this.emit(Tournament.Events.MATCH_HANDLED);
      return;
    }

    const newRankStates = this.ranksystem.updateRanks(currentRankStates, ranks);
    const updatePlayerStatsPromises: Array<Promise<void>> = [];
    tourneyIDs.forEach((info, i) => {
      const updateStat = async () => {
        const currentStats: Ladder.PlayerStat = info.stats;
        currentStats.rankState = newRankStates[i];
        await this.updatePlayerStat(currentStats);
      };
      updatePlayerStatsPromises.push(updateStat());
    });

    await Promise.all(updatePlayerStatsPromises);

    if (this.configs.consoleDisplay) {
      await this.printTournamentStatus();
    }

    this.emit(Tournament.Events.MATCH_HANDLED);
  }

  protected async preInternalDestroy(): Promise<void> {
    if (this.runInterval) clearInterval(this.runInterval);
    if (this.configSyncInterval) clearInterval(this.configSyncInterval);
  }
}

/**
 * The Ladder Tournament namespace
 */
export namespace Ladder {
  /**
   * Configuration interface for Ladder Tournaments
   */
  export interface Configs extends Tournament.TournamentTypeConfig {
    /** Max matches that can run concurrently on one node instance
     * @default 1
     */
    maxConcurrentMatches: number;
    /** The date to stop running this tournament once it is started. If null, no end date
     * @default null
     */
    endDate: Date;
    /** The max matches to run before stopping the tournament. If null, then no maximum
     * @default null
     */
    maxTotalMatches: number;

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
    matchMake: /**
     * @param playerStats - an array of all player stats in the tournament. See {@link PlayerStat} for what variables
     * are exposed to use to help schedule matches
     */
    (playerStats: Array<PlayerStat>) => Array<Tournament.QueuedMatch>;

    /**
     * Rate in ms of how fast to sync the configs. Used for synchronizing configs in a distributed system.
     *
     * @default `6000`
     */
    configSyncRefreshRate: number;

    /**
     * Whether or not to sync configs with database and other tournaments of the same id
     *
     * @default `true`
     */
    syncConfigs: boolean;

    /**
     * Whether or not this tournament will schedule its own matches using its own {@link Ladder.Configs.matchMake | matchMake} function
     *
     * @default `true`
     */
    selfMatchMake: boolean;
  }
  /**
   * The Ladder Tournament state, consisting of the current player statistics and past results
   */
  export interface State extends Tournament.TournamentTypeState {
    /**
     * A map from a {@link Player} Tournament ID string to statistics
     */
    playerStats: Map<NanoID, PlayerStat>;

    /**
     * Stats for this Tournament in this instance. Intended to be constant memory usage
     */
    statistics: {
      totalMatches: number;
    };
    currentRanks: Array<{ player: Player; rankState: any }>;
  }
  /**
   * Player stat interface for ladder tournaments
   */
  export interface PlayerStat extends Tournament.PlayerStatBase {
    /**
     * total matches played with current bot
     */
    matchesPlayed: number;
    /**
     * the ranking statistics for the player. the type of this variable is dependent on the ranking system you use for
     * the tournament. If the ranking system is {@link RankSystem.TrueSkill | TrueSkill}, then see
     * {@link RankSystem.TrueSkill.RankState} for the rank state typings.
     */
    rankState: any;
  }
}
