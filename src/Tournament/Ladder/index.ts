import { Tournament, Player } from '..';
import { DeepPartial } from '../../utils/DeepPartial';
import { Design } from '../../Design';
import { deepMerge } from '../../utils/DeepMerge';
import {
  MatchDestroyedError,
  TournamentError,
  NotSupportedError,
  TournamentPlayerDoesNotExistError,
  AgentFileError,
  AgentCompileError,
  AgentInstallError,
} from '../../DimensionError';
import { Agent } from '../../Agent';
import { Rating, rate, quality, TrueSkill } from 'ts-trueskill';
import { sprintf } from 'sprintf-js';
import { Logger } from '../../Logger';
import { ELOSystem, ELORating } from '../ELO';
import { Match } from '../../Match';
import { Dimension, NanoID } from '../../Dimension';
import { Database } from '../../Plugin/Database';
import { TournamentStatus } from '../TournamentStatus';
import { RankSystem } from '../RankSystem';
import { TournamentType } from '../TournamentTypes';

import LadderState = Ladder.State;
import LadderConfigs = Ladder.Configs;
import LadderPlayerStat = Ladder.PlayerStat;
import { nanoid } from '../..';
import { deepCopy } from '../../utils/DeepCopy';
import { Scheduler } from '../Scheduler';

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
   * ELO System used in this tournament
   */
  private elo: ELOSystem;

  /**
   * tournament runner interval, periodically calls tourneyRunner to start up new matches
   */
  private runInterval = null;

  /**
   * Configuration synchronization interval. Periodically makes a request to the DB if there is one and changes configs
   */
  private configSyncInterval = null;

  /**
   * Last modification date of configs
   */
  private configLastModificationDate = new Date(0);

  // queue of the results to process
  resultProcessingQueue: Array<{
    result: any;
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
    super(design, files, id, tournamentConfigs, dimension);
    this.configs = deepMerge(this.configs, tournamentConfigs, true);

    switch (this.configs.rankSystem) {
      case RankSystem.TRUESKILL:
        if (this.configs.rankSystemConfigs === null) {
          // set default rank system configs
          const trueskillConfigs: RankSystem.TRUESKILL.Configs = {
            initialMu: 25,
            initialSigma: 25 / 3,
          };
          this.configs.rankSystemConfigs = trueskillConfigs;
        }
        break;
      case RankSystem.ELO:
        if (this.configs.rankSystemConfigs === null) {
          // set default rank system configs
          const eloConfigs: RankSystem.ELO.Configs = {
            startingScore: 1000,
            kFactor: 32,
          };
          this.configs.rankSystemConfigs = eloConfigs;
        }
        this.elo = new ELOSystem(
          this.configs.rankSystemConfigs.kFactor,
          this.configs.rankSystemConfigs.startingScore
        );
        break;
      default:
        throw new NotSupportedError(
          'We currently do not support this rank system for ladder tournaments'
        );
    }

    files.forEach((file) => {
      if (typeof file === 'string') {
        this.initialAddPlayerPromises.push(this.addplayer(file));
      } else {
        this.initialAddPlayerPromises.push(
          this.addplayer(file, file.existingID)
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
  public async setStatus(status: Tournament.Status) {
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
  ) {
    if (configs.id) {
      throw new TournamentError(
        'You cannot change the tournament ID after constructing the tournament'
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
      this.configs = deepMerge(this.configs, configs, true);
    }
    // update DB
  }
  public async getRankings(
    offset = 0,
    limit = -1
  ): Promise<Array<LadderPlayerStat>> {
    let rankings = [];
    switch (this.configs.rankSystem) {
      case RankSystem.TRUESKILL:
        if (this.dimension.hasDatabase()) {
          rankings = await this.dimension.databasePlugin.getRanks(
            this,
            offset,
            limit
          );
          rankings = rankings.map((rank) => {
            rank.rankState.score =
              rank.rankState.rating.mu - 3 * rank.rankState.rating.sigma;
            return rank;
          });
          if (this.anonymousCompetitors.size > 0) {
            // add in anonymous competitors in
            this.anonymousCompetitors.forEach((player) => {
              const stat = this.state.playerStats.get(player.tournamentID.id);
              const rankState = <RankSystem.TRUESKILL.RankState>stat.rankState;

              rankings.push({
                player: stat.player,
                name: stat.player.tournamentID.name,
                id: stat.player.tournamentID.id,
                matchesPlayed: stat.matchesPlayed,
                rankState: {
                  rating: {
                    ...rankState.rating,
                    mu: rankState.rating.mu,
                    sigma: rankState.rating.sigma,
                  },
                  score: rankState.rating.mu - 3 * rankState.rating.sigma,
                },
              });
            });
            // re sort
            rankings.sort((a, b) => {
              return b.rankState.score - a.rankState.score;
            });
          }
          break;
        } else {
          this.state.playerStats.forEach((stat) => {
            const rankState = <RankSystem.TRUESKILL.RankState>stat.rankState;

            rankings.push({
              player: stat.player,
              name: stat.player.tournamentID.name,
              id: stat.player.tournamentID.id,
              matchesPlayed: stat.matchesPlayed,
              rankState: {
                rating: {
                  ...rankState.rating,
                  mu: rankState.rating.mu,
                  sigma: rankState.rating.sigma,
                },
                score: rankState.rating.mu - 3 * rankState.rating.sigma,
              },
            });
          });
        }
        rankings.sort((a, b) => {
          return b.rankState.score - a.rankState.score;
        });
        break;
      case RankSystem.ELO:
        if (this.dimension.hasDatabase()) {
          rankings = await this.dimension.databasePlugin.getRanks(
            this,
            offset,
            limit
          );
          if (this.anonymousCompetitors.size > 0) {
            // add in anonymous competitors in
            this.anonymousCompetitors.forEach((player) => {
              const stat = this.state.playerStats.get(player.tournamentID.id);
              const rankState = <RankSystem.TRUESKILL.RankState>stat.rankState;

              rankings.push({
                player: stat.player,
                name: stat.player.tournamentID.name,
                id: stat.player.tournamentID.id,
                matchesPlayed: stat.matchesPlayed,
                rankState: rankState,
              });
            });
            // re sort
            rankings.sort((a, b) => {
              return b.rankState.rating.score - a.rankState.rating.score;
            });
          }
          break;
        } else {
          this.state.playerStats.forEach((stat) => {
            const rankState = <RankSystem.ELO.RankState>stat.rankState;
            rankings.push({
              player: stat.player,
              name: stat.player.tournamentID.name,
              id: stat.player.tournamentID.id,
              matchesPlayed: stat.matchesPlayed,
              rankState: rankState,
            });
          });
        }
        rankings.sort((a, b) => {
          return b.rankState.rating.score - a.rankState.rating.score;
        });
        break;
    }
    return rankings;
  }

  /**
   * Resets rankings of all competitors loaded to initial scores
   */
  public async resetRankings() {
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
        switch (this.configs.rankSystem) {
          case RankSystem.TRUESKILL:
            stats.matchesPlayed = 0;
            const trueskillConfigs: RankSystem.TRUESKILL.Configs = this.configs
              .rankSystemConfigs;

            (<RankSystem.TRUESKILL.RankState>stats.rankState) = {
              rating: new Rating(
                trueskillConfigs.initialMu,
                trueskillConfigs.initialSigma
              ),
            };
            if (this.dimension.hasDatabase()) {
              await this.updateDatabaseTrueskillPlayerStats(stats, userList[i]);
            }
            break;
          case RankSystem.ELO:
            stats.matchesPlayed = 0;
            stats.rankState = {
              rating: this.elo.createRating(),
            };
            if (this.dimension.hasDatabase()) {
              await this.updateDatabaseELOPlayerStats(stats, userList[i]);
            }
            break;
        }
      };
      updatePromises.push(resetPlayer());
    });
    await Promise.all(updatePromises);
  }

  /**
   * Stops the tournament if it was running.
   * @param master - whether or not the instance calling stop was the first one, the "master" instance
   */
  public async stop(master = false) {
    if (this.status !== TournamentStatus.RUNNING) {
      throw new TournamentError(`Can't stop a tournament that isn't running`);
    }
    this.log.info('Stopping Tournament...');
    clearInterval(this.runInterval);
    if (master) {
      await this.setStatus(TournamentStatus.STOPPED);
    } else {
      this.status = TournamentStatus.STOPPED;
    }
  }

  /**
   * Resumes the tournament if it was stopped.
   * @param master - whether or not the instance calling stop was the first one, the "master" instance
   */
  public async resume(master = false) {
    if (this.status !== TournamentStatus.STOPPED) {
      throw new TournamentError(`Can't resume a tournament that isn't stopped`);
    }
    this.log.info('Resuming Tournament...');
    if (master) {
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
  ) {
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
    )
      return;

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
   * Performs a Fisher Yates Shuffle
   * @param arr - the array to shuffle
   */
  private shuffle<T>(arr: T[]) {
    for (let i = arr.length - 1; i >= 1; i--) {
      const j = Math.floor(Math.random() * i);
      const tmp = arr[i];
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
  private async updateDatabaseTrueskillPlayerStats(
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
      const rankStateRating = update.statistics[keyName].rankState.rating;

      // make sure to store mu and sigma
      update.statistics[keyName].rankState = {
        rating: {
          ...rankStateRating,
          mu: rankStateRating.mu,
          sigma: rankStateRating.sigma,
        },
      };
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

  /**
   * Updates database with ELO player stats
   *
   * If failure occurs, we ignore it and just log it as we will likely in the future perform an update operation
   * on the database again anyway
   *
   * @param playerStat
   * @param user
   */
  private async updateDatabaseELOPlayerStats(
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

  /**
   * Initialize trueskill player stats. Pulls data from database if it exists and uses past stats to fill in
   * @param player
   *
   * This is probably a nightmare to test
   */
  private async initializeTrueskillPlayerStats(player: Player) {
    const trueskillConfigs: RankSystem.TRUESKILL.Configs = this.configs
      .rankSystemConfigs;

    let playerStat: any = null;

    // get any existing rating data
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
            playerStat.rankState = {
              rating: new Rating(
                playerStat.rankState.rating.mu,
                playerStat.rankState.rating.sigma
              ),
            };
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
          rating: new Rating(
            trueskillConfigs.initialMu,
            trueskillConfigs.initialSigma
          ),
        },
      };
      await this.updateDatabaseTrueskillPlayerStats(playerStat, user);
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
      user = await this.dimension.databasePlugin.getUser(
        player.tournamentID.id
      );
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
          rating: this.elo.createRating(),
        },
      };
      // store defaults into database
      if (!player.anonymous && this.dimension.hasDatabase()) {
        const update = {
          statistics: user ? user.statistics : {},
        };
        update.statistics[this.getKeyName()] = playerStat;
        await this.dimension.databasePlugin.updateUser(
          player.tournamentID.id,
          update
        );
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
    const promises: Array<Promise<void>> = [];
    switch (this.configs.rankSystem) {
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
   * Schedules matches to play. By default uses {@link Scheduler.RankRangeRandom}
   *
   * If a {@link Ladder.Configs.matchMake | matchMake} function is provided, that will be used instead of the default.
   */
  private async schedule() {
    // TODO: Consider slide window instead for dealing with rankings?
    const rankings = await this.getRankings(0, -1);
    if (this.configs.tournamentConfigs.matchMake) {
      const newMatches = this.configs.tournamentConfigs.matchMake(rankings);
      this.matchQueue.push(...newMatches);
      return;
    }
  }

  /** Schedule a match using match info */
  public scheduleMatches(...matchInfos: Array<Tournament.QueuedMatch>) {
    this.matchQueue.push(...matchInfos);
    // kick off the runner to process any matches
    this.tourneyRunner();
  }

  // called adding a new player
  async internalAddPlayer(player: Player) {
    switch (this.configs.rankSystem) {
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
    const { user, playerStat } = await this.getPlayerStat(player.tournamentID.id);
    const playerStats = <Ladder.PlayerStat>playerStat;
    playerStats.player = player;
    playerStats.matchesPlayed = 0;
    playerStats.losses = 0;
    playerStats.wins = 0;
    playerStats.ties = 0;
    switch (this.configs.rankSystem) {
      case RankSystem.ELO: {
        const rankSystemConfigs = <RankSystem.ELO.Configs>(
          this.configs.rankSystemConfigs
        );
        const currState = <RankSystem.ELO.RankState>playerStats.rankState;

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
        const rankSystemConfigs = <RankSystem.TRUESKILL.Configs>(
          this.configs.rankSystemConfigs
        );
        const currState = <RankSystem.TRUESKILL.RankState>playerStats.rankState;

        // TODO: Give user option to define how to reset score
        currState.rating = new Rating(
          currState.rating.mu,
          rankSystemConfigs.initialSigma
        );
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
   * Removes player from tournament. Removes from state and stats from database
   * @param playerID
   */
  async internalRemovePlayer(playerID: nanoid) {
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

      switch (this.configs.rankSystem) {
        case RankSystem.TRUESKILL:
          console.log(
            sprintf(
              `%-30s | %-14s | %-15s | %-18s | %-8s`.underline,
              'Name',
              'ID',
              'Score=(μ - 3σ)',
              'Mu: μ, Sigma: σ',
              'Matches'
            )
          );
          ranks.forEach((info) => {
            console.log(
              sprintf(
                `%-30s`.blue +
                  ` | %-14s | ` +
                  `%-15s`.green +
                  ` | ` +
                  `μ=%-6s, σ=%-6s`.yellow +
                  ` | %-8s`,
                info.player.tournamentID.name +
                  (info.player.disabled ? ' X' : ''),
                info.player.tournamentID.id,
                (
                  info.rankState.rating.mu -
                  info.rankState.rating.sigma * 3
                ).toFixed(7),
                info.rankState.rating.mu.toFixed(3),
                info.rankState.rating.sigma.toFixed(3),
                info.matchesPlayed
              )
            );
          });
          break;
        case RankSystem.ELO:
          console.log(
            sprintf(
              `%-30s | %-8s | %-15s | %-8s`.underline,
              'Name',
              'ID',
              'ELO Score',
              'Matches'
            )
          );
          ranks.forEach((info) => {
            console.log(
              sprintf(
                `%-30s`.blue + ` | %-8s | ` + `%-15s`.green + ` | %-8s`,
                info.player.tournamentID.name,
                info.player.tournamentID.id,
                info.rankState.rating.score,
                info.matchesPlayed
              )
            );
          });
          break;
      }
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
    let matchRes: { results: any; match: Match; err?: any };
    matchRes = await this.runMatch(matchInfo);
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
    switch (this.configs.rankSystem) {
      case RankSystem.TRUESKILL:
        // push to result processing queue
        this.resultProcessingQueue.push({
          result: resInfo,
          mapAgentIDtoTournamentID: matchRes.match.mapAgentIDtoTournamentID,
        });
        // make a call to handle match with trueskill to process the next result in the processing queue
        this.handleMatchWithTrueSkill();
        break;
      case RankSystem.ELO:
        // push to result processing queue
        this.resultProcessingQueue.push({
          result: resInfo,
          mapAgentIDtoTournamentID: matchRes.match.mapAgentIDtoTournamentID,
        });
        this.handleMatchWithELO();
        break;
    }

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
   * Update player stats for whoever stats owns this. Determined by checking the player field of
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
        if (user && user.statistics[this.getKeyName()]) {
          switch (this.configs.rankSystem) {
            case RankSystem.TRUESKILL:
              await this.updateDatabaseTrueskillPlayerStats(currentStats, user);
              break;
            case RankSystem.ELO:
              await this.updateDatabaseELOPlayerStats(currentStats, user);
              break;
          }
        }
      } catch (err) {
        // don't stop tourney if this happens
        this.log.error(`Issue with using database`, err);
      }
    }
  }

  /**
   * Handles match results.
   *
   * If match result is {ranks: []}, nothing will happen, can be used to mark a match as having errored
   */
  private async handleMatchWithTrueSkill() {
    // TODO, a lot of code repeated with ELO as well. Abstract to "ranksystem class" and have abstract functions for
    // handling match results, updating rank states etc. Ideally in Ladder there should only be calls to various logic // linking these updates with local state or db
    const toProcess = this.resultProcessingQueue.shift();
    const mapAgentIDtoTournamentID = toProcess.mapAgentIDtoTournamentID;
    const result = <RankSystem.TRUESKILL.Results>toProcess.result;

    // stop if no ranks provided, meaning match not successful and we throw result away
    if (result.ranks.length === 0) {
      this.emit(Tournament.Events.MATCH_HANDLED);
      return;
    }

    const playerRatings: Array<Array<Rating>> = [];
    const tourneyIDs: Array<{ id: Tournament.ID; stats: any }> = [];
    const ranks: Array<number> = [];
    result.ranks.sort((a, b) => a.rank - b.rank);

    const fetchingRatings: Array<Promise<void>> = [];
    result.ranks.forEach((rank) => {
      const fetchRating = async () => {
        const tournamentID = mapAgentIDtoTournamentID.get(rank.agentID);

        /**
         * Future TODO: Acquire and release locks on an DB entry.
         * realistically only matters if DB is slow or many matches run with a player
         */
        const { playerStat } = await this.getPlayerStat(tournamentID.id);
        if (!playerStat) {
          throw new TournamentPlayerDoesNotExistError(
            `Player ${tournamentID.id} doesn't exist anymore, likely was removed`
          );
        }
        const currentplayerStats = <Ladder.PlayerStat>playerStat;
        currentplayerStats.matchesPlayed++;

        const currRankState = <RankSystem.TRUESKILL.RankState>(
          currentplayerStats.rankState
        );
        playerRatings.push([currRankState.rating]);
        ranks.push(rank.rank);
        tourneyIDs.push({ id: tournamentID, stats: currentplayerStats });
      };
      fetchingRatings.push(fetchRating());
    });
    try {
      await Promise.all(fetchingRatings);
    } catch (err) {
      this.log.error('Probably due to player being removed: ', err);
      this.emit(Tournament.Events.MATCH_HANDLED);
      return;
    }

    const newRatings = rate(playerRatings, ranks);
    const updatePlayerStatsPromises: Array<Promise<void>> = [];
    tourneyIDs.forEach((info, i) => {
      const updateStat = async () => {
        const currentStats: Ladder.PlayerStat = info.stats;
        (<RankSystem.TRUESKILL.RankState>currentStats.rankState).rating =
          newRatings[i][0];

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

  private async handleMatchWithELO() {
    const toProcess = this.resultProcessingQueue.shift();
    const mapAgentIDtoTournamentID = toProcess.mapAgentIDtoTournamentID;
    const result = <RankSystem.ELO.Results>toProcess.result;

    // stop if no ranks provided, meaning match not successful and we throw result away
    if (result.ranks.length === 0) {
      this.emit(Tournament.Events.MATCH_HANDLED);
      return;
    }

    const ratingsToChange: Array<ELORating> = [];
    const ranks = [];
    const tourneyIDs: Array<{ id: Tournament.ID; stats: any }> = [];
    const fetchingRatings: Array<Promise<void>> = [];
    result.ranks.forEach((rankInfo) => {
      const fetchRating = async () => {
        const tournamentID = mapAgentIDtoTournamentID.get(rankInfo.agentID);

        const { playerStat } = await this.getPlayerStat(tournamentID.id);
        if (!playerStat) {
          this.emit(Tournament.Events.MATCH_HANDLED);
          throw new TournamentPlayerDoesNotExistError(
            `Player ${tournamentID.id} doesn't exist anymore, likely was removed`
          );
        }
        const currentplayerStats = <Ladder.PlayerStat>playerStat;
        currentplayerStats.matchesPlayed++;

        const currRankState = <RankSystem.ELO.RankState>(
          currentplayerStats.rankState
        );
        ratingsToChange.push(currRankState.rating);
        ranks.push(rankInfo.rank);
        tourneyIDs.push({ id: tournamentID, stats: currentplayerStats });
      };
      fetchingRatings.push(fetchRating());
    });

    try {
      await Promise.all(fetchingRatings);
    } catch (err) {
      this.emit(Tournament.Events.MATCH_HANDLED);
      this.log.error('Probably due to player being removed: ', err);
      return;
    }

    // re adjust rankings
    this.elo.rate(ratingsToChange, ranks);

    const updatePlayerStatsPromises: Array<Promise<void>> = [];
    // update database if needed and store play stats
    tourneyIDs.forEach((info) => {
      const updateStat = async () => {
        const currentStats = info.stats;
        updatePlayerStatsPromises.push(this.updatePlayerStat(currentStats));
      };
      updatePlayerStatsPromises.push(updateStat());
    });
    await Promise.all(updatePlayerStatsPromises);

    if (this.configs.consoleDisplay) {
      await this.printTournamentStatus();
    }

    this.emit(Tournament.Events.MATCH_HANDLED);
  }

  protected async preInternalDestroy() {
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
    wins: number;
    ties: number;
    losses: number;
    /**
     * total matches played
     */
    matchesPlayed: number;
    /**
     * the ranking statistics for the player. the type of this variable is dependent on the ranking system you use for
     * the tournament. If the ranking system is {@link RankSystem.TRUESKILL | Trueskill}, then see
     * {@link RankSystem.TRUESKILL.RankState} for the rank state typings.
     */
    rankState: any;
  }
}
