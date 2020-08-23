import { Tournament, Player } from '..';
import { DeepPartial } from '../../utils/DeepPartial';
import { Design } from '../../Design';
import { deepMerge } from '../../utils/DeepMerge';
import {
  FatalError,
  TournamentError,
  NotSupportedError,
} from '../../DimensionError';
import { Agent } from '../../Agent';
import { Logger } from '../../Logger';
import RankSystem = Tournament.RankSystem;
import { sprintf } from 'sprintf-js';
import { Dimension, NanoID } from '../../Dimension';

/**
 * The Round Robin Tournament Class
 *
 * Only supports two agent matches at the moment and is meant for single instance use only
 */
export class RoundRobin extends Tournament {
  configs: Tournament.TournamentConfigs<Tournament.RoundRobin.Configs> = {
    defaultMatchConfigs: {},
    type: Tournament.Type.ROUND_ROBIN,
    rankSystem: null,
    rankSystemConfigs: null,
    tournamentConfigs: {
      times: 2,
      storePastResults: true,
    },
    agentsPerMatch: [2],
    resultHandler: null,
    consoleDisplay: true,
    id: 'aa2qlM',
  };

  type = Tournament.Type.ROUND_ROBIN;

  private shouldStop: boolean = false;
  private resumePromise: Promise<void>;
  private resumeResolver: Function;
  private resolveStopPromise: Function;

  public state: Tournament.RoundRobin.State = {
    playerStats: new Map(),
    results: [],
    statistics: {
      totalMatches: 0,
    },
  };
  constructor(
    design: Design,
    files: Array<string> | Array<{ file: string; name: string }>,
    tournamentConfigs: Tournament.TournamentConfigsBase,
    id: NanoID,
    dimension: Dimension
  ) {
    super(design, files, id, tournamentConfigs, dimension);
    if (tournamentConfigs.consoleDisplay) {
      this.configs.consoleDisplay = tournamentConfigs.consoleDisplay;
    }

    // handle config defaults
    if (tournamentConfigs.rankSystem !== Tournament.RankSystem.WINS) {
      throw new NotSupportedError(
        'We currently do not support Round Robin tournaments with ranking system other than wins system'
      );
    }
    for (let i = 0; i < tournamentConfigs.agentsPerMatch.length; i++) {
      if (tournamentConfigs.agentsPerMatch[i] != 2)
        throw new NotSupportedError(
          'We currently only support 2 agents per match for Round Robin '
        );
    }
    if (!tournamentConfigs.rankSystemConfigs) {
      this.configs.rankSystemConfigs = {
        winValue: 3,
        tieValue: 1,
        lossValue: 0,
        ascending: false,
      };
    }

    // TODO we need to type check the result handler and see if it is correct. Throw a error if handler is of wrong format at runtime somehow

    // handle rest. pass true flag to make sure arrays are clobbered and not merged
    this.configs = deepMerge(this.configs, tournamentConfigs, true);

    // add all players
    files.forEach((file) => {
      this.initialAddPlayerPromises.push(this.addplayer(file));
    });

    this.status = Tournament.Status.INITIALIZED;
    this.log.info('Initialized Round Robin Tournament');
  }

  /**
   * Runs a round robin to completion. Resolves with the {@link RoundRobin.State} once the tournament is finished
   * @param configs - the configs to use for this run
   */
  public async run(
    configs?: DeepPartial<
      Tournament.TournamentConfigs<Tournament.RoundRobin.Configs>
    >
  ) {
    this.status = Tournament.Status.RUNNING;
    this.log.info('Running Tournament');
    this.configs = deepMerge(this.configs, configs, true);
    await this.initialize();
    this.schedule();
    // running one at a time
    while (this.matchQueue.length) {
      // stop logic
      if (this.shouldStop) {
        this.log.info('Stopped Tournament');
        this.resolveStopPromise();
        await this.resumePromise;
        this.log.info('Resumed Tournament');
        this.shouldStop = false;
      }
      let matchInfo = this.matchQueue.shift();
      await this.handleMatch(matchInfo);
    }
    this.status = Tournament.Status.FINISHED;
    return this.state;
  }

  /**
   * Handles the start and end of a match, and updates state accrding to match results and the given result handler
   * @param matchInfo
   */
  private async handleMatch(queuedMatchInfo: Tournament.QueuedMatch) {
    let matchInfo = await this.getMatchInfoFromQueuedMatch(queuedMatchInfo);

    if (this.configs.consoleDisplay) {
      this.printTournamentStatus();
      console.log();
      console.log('Current Matches: ' + (this.matches.size + 1));
      this.matches.forEach((match) => {
        let names: Array<string> = [];
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

    this.log.detail(
      'Running match - Competitors: ',
      matchInfo.map((player) => player.tournamentID.name)
    );
    let matchRes = await this.runMatch(matchInfo);
    let resInfo = <Tournament.RankSystem.WINS.Results>(
      this.configs.resultHandler(matchRes.results)
    );

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

    // update total matches
    this.state.statistics.totalMatches++;
    // update matches played per player
    matchInfo.map((player) => {
      let oldplayerStat = this.state.playerStats.get(player.tournamentID.id);
      oldplayerStat.matchesPlayed++;
      this.state.playerStats.set(player.tournamentID.id, oldplayerStat);
    });

    // handle winners, tied, and losers players and update their stats
    resInfo.winners.forEach((winnerID: Agent.ID) => {
      // resInfo contains agentIDs, which need to be remapped to tournament IDs
      let tournamentID = matchRes.match.mapAgentIDtoTournamentID.get(winnerID);
      let oldplayerStat = this.state.playerStats.get(tournamentID.id);
      oldplayerStat.wins++;
      this.state.playerStats.set(tournamentID.id, oldplayerStat);
    });
    resInfo.ties.forEach((tieplayerID: Agent.ID) => {
      let tournamentID = matchRes.match.mapAgentIDtoTournamentID.get(
        tieplayerID
      );
      let oldplayerStat = this.state.playerStats.get(tournamentID.id);
      oldplayerStat.ties++;
      this.state.playerStats.set(tournamentID.id, oldplayerStat);
    });
    resInfo.losers.forEach((loserplayerID: Agent.ID) => {
      let tournamentID = matchRes.match.mapAgentIDtoTournamentID.get(
        loserplayerID
      );
      let oldplayerStat = this.state.playerStats.get(tournamentID.id);
      oldplayerStat.losses++;
      this.state.playerStats.set(tournamentID.id, oldplayerStat);
    });
    if (this.configs.consoleDisplay) {
      this.printTournamentStatus();
      console.log();
      console.log('Current Matches: ' + this.matches.size);
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
   * Stops the tournament
   */
  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.status !== Tournament.Status.RUNNING) {
        throw new TournamentError(`Can't stop a tournament that isn't running`);
      }
      this.log.info('Stopping Tournament...');
      this.status = Tournament.Status.STOPPED;
      this.resumePromise = new Promise((resumeResolve) => {
        this.resumeResolver = resumeResolve;
      });
      this.shouldStop = true;
      this.resolveStopPromise = resolve;
    });
  }

  /**
   * Resumes the tournament
   */
  public async resume(): Promise<void> {
    if (this.status !== Tournament.Status.STOPPED) {
      throw new TournamentError(`Can't resume a tournament that isn't stopped`);
    }

    this.log.info('Resuming Tournament...');
    this.status = Tournament.Status.RUNNING;
    this.resumeResolver();
  }

  // TODO: move sorting to run function. It's ok too sort like this for small leagues, but larger will become slow.
  /**
   * Returns the current rankings
   */
  public getRankings() {
    let ranks = [];
    this.state.playerStats.forEach((playerStat) => {
      let score =
        playerStat.wins * this.configs.rankSystemConfigs.winValue +
        playerStat.ties * this.configs.rankSystemConfigs.tieValue +
        playerStat.losses * this.configs.rankSystemConfigs.lossValue;
      ranks.push({
        player: playerStat.player,
        name: playerStat.player.tournamentID.name,
        id: playerStat.player.tournamentID.id,
        score: score,
        wins: playerStat.wins,
        losses: playerStat.losses,
        ties: playerStat.ties,
        matchesPlayed: playerStat.matchesPlayed,
      });
    });
    if (this.configs.rankSystemConfigs.ascending) {
      ranks.sort((a, b) => {
        return b.score - a.score;
      });
    } else {
      ranks.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return ranks;
  }

  /**
   * Gets the current configs
   */
  public getConfigs(): Tournament.TournamentConfigs<
    Tournament.RoundRobin.Configs
  > {
    return this.configs;
  }

  /**
   * Sets the configs
   * @param configs - configs to use
   */
  public setConfigs(
    configs: DeepPartial<
      Tournament.TournamentConfigs<Tournament.RoundRobin.Configs>
    > = {}
  ) {
    this.configs = deepMerge(this.configs, configs, true);
  }

  private async initialize() {
    await Promise.all(this.initialAddPlayerPromises);
    this.state.playerStats = new Map();
    this.state.results = [];
    this.competitors.forEach((player) => {
      this.state.playerStats.set(player.tournamentID.id, {
        player: player,
        wins: 0,
        ties: 0,
        losses: 0,
        matchesPlayed: 0,
      });
    });
    if (this.configs.consoleDisplay) {
      this.printTournamentStatus();
    }
  }

  /**
   * Queue up all matches necessary
   */
  private schedule() {
    this.log.detail('Scheduling... ');
    let matchSets: Array<Tournament.QueuedMatch> = [];
    for (let i = 0; i < this.configs.tournamentConfigs.times; i++) {
      matchSets.push(...this.generateARound());
    }
    this.matchQueue = matchSets;
  }
  private generateARound() {
    let roundQueue: Array<Tournament.QueuedMatch> = [];

    let comp = Array.from(this.competitors.values());
    for (let i = 0; i < this.competitors.size; i++) {
      for (let j = i + 1; j < this.competitors.size; j++) {
        let player1 = comp[i];
        let player2 = comp[j];
        roundQueue.push([player1.tournamentID.id, player2.tournamentID.id]);
      }
    }
    return roundQueue;
  }

  async internalAddPlayer(player: Player) {
    return;
  }
  async updatePlayer(player: Player, oldname: string, oldfile: string) {
    throw new TournamentError(
      'You are not allowed to update a player during elimination tournaments'
    );
  }

  private printTournamentStatus() {
    if (this.log.level > Logger.LEVEL.NONE) {
      console.clear();
      console.log(this.log.bar());
      console.log(
        `Tournament - ID: ${this.id}, Name: ${this.name} | Dimension - ID: ${this.dimension.id}, Name: ${this.dimension.name}\nStatus: ${this.status} | Competitors: ${this.competitors.size} | Rank System: ${this.configs.rankSystem}\n`
      );
      console.log('Total Matches: ' + this.state.statistics.totalMatches);
      let ranks = this.getRankings();
      switch (this.configs.rankSystem) {
        case Tournament.RankSystem.WINS:
          console.log(
            sprintf(
              `%-20s | %-8s | %-15s | %-6s | %-6s | %-8s | %-8s`.underline,
              'Name',
              'ID',
              'Score',
              'Wins',
              'Ties',
              'Losses',
              'Matches'
            )
          );
          ranks.forEach((info) => {
            console.log(
              sprintf(
                `%-20s`.blue +
                  ` | %-8s | ` +
                  `%-15s`.green +
                  ` | %-6s | %-6s | %-8s | %-8s`,
                info.player.tournamentID.name,
                info.player.tournamentID.id,
                info.score.toFixed(3),
                info.wins,
                info.ties,
                info.losses,
                info.matchesPlayed
              )
            );
          });
          break;
      }
    }
  }
}

/**
 * The RoundRobin Tournament namespace
 */
export namespace RoundRobin {
  /**
   * Configuration interface for RoundRobin Tournaments
   */
  export interface Configs extends Tournament.TournamentTypeConfig {
    /**
     * Number of times each player competes against another player
     * @default `2`
     */
    times: number;
  }
  /**
   * The RoundRobin Tournament state, consisting of the current player statistics and past results
   */
  export interface State extends Tournament.TournamentTypeState {
    /**
     * A map from a {@link Player} Tournament ID string to statistics
     */
    playerStats: Map<
      string,
      {
        player: Player;
        wins: number;
        ties: number;
        losses: number;
        matchesPlayed: number;
      }
    >;

    /**
     * Stats for this Tournament in this instance. Intended to be constant memory usage
     */
    statistics: {
      totalMatches: number;
    };
  }
}
