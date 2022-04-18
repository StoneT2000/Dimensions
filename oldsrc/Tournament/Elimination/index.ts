import { Tournament, Player } from '..';
import { DeepPartial } from '../../utils/DeepPartial';
import { Design } from '../../Design';
import { deepMerge } from '../../utils/DeepMerge';

import {
  FatalError,
  TournamentError,
  NotSupportedError,
} from '../../DimensionError';
import { Dimension, NanoID } from '../../Dimension';

import EliminationState = Elimination.State;
import EliminationConfigs = Elimination.Configs;
import { RankSystem } from '../RankSystem';

/**
 * The Elimination Tournament Class. Runs a single-elimination tournament.
 *
 * Meant for single instance use only
 */
export class Elimination extends Tournament {
  configs: Tournament.TournamentConfigs<EliminationConfigs> = {
    defaultMatchConfigs: {},
    type: Tournament.Type.ELIMINATION,
    rankSystem: null,
    rankSystemConfigs: null,
    tournamentConfigs: {
      times: 1,
      storePastResults: true,
      lives: 1,
      seeding: null,
    },
    resultHandler: null,
    agentsPerMatch: [2],
    consoleDisplay: true,
    id: 'z3Ap49',
  };
  state: EliminationState = {
    playerStats: new Map(),
    statistics: {
      totalMatches: 0,
    },
    currentRound: null,
    results: [],
    resultsMap: new Map(),
  };
  matchHashes: Array<string> = [];

  type = Tournament.Type.ELIMINATION;

  private shouldStop = false;
  private resumePromise: Promise<void>;
  private resumeResolver: Function;
  private resolveStopPromise: Function;

  constructor(
    design: Design,
    files: Array<string> | Array<{ file: string; name: string }>,
    tournamentConfigs: Tournament.TournamentConfigsBase,
    id: NanoID,
    dimension: Dimension
  ) {
    super(design, id, tournamentConfigs, dimension);
    if (tournamentConfigs.consoleDisplay) {
      this.configs.consoleDisplay = tournamentConfigs.consoleDisplay;
    }
    this.configs = deepMerge(this.configs, tournamentConfigs, true);
    if (typeof this.configs.rankSystem === 'string') {
      switch (tournamentConfigs.rankSystem) {
        case Tournament.RankSystemTypes.WINS: {
          // set default rank system configs
          const winsConfigs: RankSystem.Wins.Configs = {
            winValue: 3,
            lossValue: 0,
            tieValue: 0,
            descending: true,
          };
          if (this.configs.rankSystemConfigs === null) {
            this.configs.rankSystemConfigs = winsConfigs;
          }
          break;
        }
        default:
          throw new NotSupportedError(
            'We currently do not support this rank system for elimination tournaments'
          );
      }
    } else {
      throw new NotSupportedError(
        "We do not support custom rank systems for elimination tournaments. Please pass in 'wins' or Tournament.RankSystemTypes.WINS instead"
      );
    }
    // add all players
    files.forEach((file) => {
      this.addplayer(file);
    });
  }

  /**
   * Get the current tournament configs
   */
  public getConfigs(): Tournament.TournamentConfigs<EliminationConfigs> {
    return this.configs;
  }

  /**
   * Set configs to use. Merges the provided configurations and overwrites provided fields with what is provided
   * @param configs - new tournament configs to update with
   */
  public setConfigs(
    configs: DeepPartial<Tournament.TournamentConfigs<EliminationConfigs>> = {}
  ): void {
    this.configs = deepMerge(this.configs, configs, true);
  }

  /**
   * Gets the rankings of the tournament. This will return the tournament rankings in the elimination tournament
   */
  public getRankings(): Array<{
    player: Player;
    wins: number;
    losses: number;
    matchesPlayed: number;
    seed: number;
    rank: number;
  }> {
    const ranks = Array.from(this.state.playerStats).sort(
      (a, b) => a[1].rank - b[1].rank
    );
    return ranks.map((a) => a[1]);
  }

  /**
   * Stops the tournament if it's running
   */
  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.status !== Tournament.Status.RUNNING) {
        reject(
          new TournamentError(`Can't stop a tournament that isn't running`)
        );
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
   * Reesumes the tournament if it's stopped
   */
  public async resume(): Promise<void> {
    if (this.status !== Tournament.Status.STOPPED) {
      throw new TournamentError(`Can't resume a tournament that isn't stopped`);
    }
    this.log.info('Resuming Tournament...');
    this.status = Tournament.Status.RUNNING;
    this.resumeResolver();
  }

  /**
   * Runs the tournament to completion. Resolves with {@link Elimination.State} once the tournament is finished
   * @param configs - tournament configurations to use
   */
  public async run(
    configs?: DeepPartial<Tournament.TournamentConfigs<EliminationConfigs>>
  ): Promise<Elimination.State> {
    this.configs = deepMerge(this.configs, configs, true);
    this.initialize();

    this.status = Tournament.Status.RUNNING;

    while (this.matchQueue.length) {
      // stop logic
      if (this.shouldStop) {
        this.log.info('Stopped Tournament');
        this.resolveStopPromise();

        // we wait for the resume function to resolve the resumePromise to continue the loop
        await this.resumePromise;
        this.log.info('Resumed Tournament');
        this.shouldStop = false;
      }
      const queuedMatchInfo = this.matchQueue.shift();
      const matchHash = this.matchHashes.shift();
      await this.handleMatch(queuedMatchInfo, matchHash);
      if (this.state.currentRound === 2) {
        break;
      }
      if (this.matchQueue.length === 0) {
        // once a round is done, perform the next round
        this.generateRound();
      }
    }
    this.status = Tournament.Status.FINISHED;
    return this.state;
  }

  /**
   * Handles a match and updates stats appropriately
   * @param matchInfo - The match to run
   */
  private async handleMatch(
    queuedMatchInfo: Tournament.QueuedMatch,
    matchHash: string
  ) {
    const matchInfo = await this.getMatchInfoFromQueuedMatch(queuedMatchInfo);
    if (matchInfo.length != 2) {
      throw new FatalError(
        `This shouldn't happen, tried to run a match with player count not equal to 2 in an elimination tournament`
      );
    }
    // deal with case when one is a null, likely meaning a competitor has a bye
    if (matchInfo[0] == null) {
      const winner = matchInfo[1];
      // store result into with matchHash key
      this.state.resultsMap.set(matchHash, { winner: winner, loser: null });
      return;
    } else if (matchInfo[1] == null) {
      const winner = matchInfo[0];
      // store result into with matchHash key
      this.state.resultsMap.set(matchHash, { winner: winner, loser: null });
      return;
    }

    this.log.detail(
      'Running match - Competitors: ',
      matchInfo.map((player) => {
        return player.tournamentID.name;
      })
    );
    const matchRes = await this.runMatch(matchInfo);
    const res: RankSystem.Results = this.configs.resultHandler(
      matchRes.results
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
        this.state.results.push(res);
      }
    }
    this.state.statistics.totalMatches++;

    const rankSystemConfigs: RankSystem.Wins.Configs = this.configs
      .rankSystemConfigs;
    // maps tournament ID to scores
    const parsedRes = {};
    const p0ID = matchInfo[0].tournamentID.id;
    const p1ID = matchInfo[1].tournamentID.id;
    parsedRes[p0ID] = 0;
    parsedRes[p1ID] = 0;

    res.ranks.sort((a, b) => a.rank - b.rank);
    if (res.ranks[0].rank === res.ranks[1].rank) {
      res.ranks.forEach((info) => {
        const tournamentID = matchRes.match.mapAgentIDtoTournamentID.get(
          info.agentID
        );
        parsedRes[tournamentID.id] += rankSystemConfigs.tieValue;
      });
    } else {
      const winningTournamentID = matchRes.match.mapAgentIDtoTournamentID.get(
        res.ranks[0].agentID
      );
      const losingTournamentID = matchRes.match.mapAgentIDtoTournamentID.get(
        res.ranks[1].agentID
      );
      parsedRes[winningTournamentID.id] += rankSystemConfigs.winValue;
      parsedRes[losingTournamentID.id] += rankSystemConfigs.lossValue;
    }

    // using scores, determine winner
    let winner = this.state.playerStats.get(p0ID);
    let loser = this.state.playerStats.get(p1ID);
    if (parsedRes[p0ID] < parsedRes[p1ID]) {
      winner = this.state.playerStats.get(p1ID);
      loser = this.state.playerStats.get(p0ID);
    } else if (parsedRes[p0ID] === parsedRes[p1ID]) {
      if (Math.random() > 0.5) {
        winner = this.state.playerStats.get(p1ID);
        loser = this.state.playerStats.get(p0ID);
      }
    }

    // update stats
    winner.wins++;
    winner.matchesPlayed++;
    loser.losses++;
    loser.matchesPlayed++;
    loser.rank = this.state.currentRound;

    // store result into with matchHash key
    this.state.resultsMap.set(matchHash, {
      winner: winner.player,
      loser: loser.player,
    });
  }

  private initialize() {
    this.state.playerStats = new Map();
    this.state.results = [];
    switch (this.configs.rankSystem) {
      case Tournament.RankSystemTypes.WINS: {
        // set up the seeding array and fill it up with null to fill up all empty spots
        let seeding = this.configs.tournamentConfigs.seeding;
        if (seeding == null) seeding = [];
        if (seeding.length > this.competitors.size) {
          throw new TournamentError(
            `Seeds provided cannot be greater than the number of competitors`
          );
        }
        for (let i = 0; i < this.competitors.size - seeding.length; i++) {
          seeding.push(null);
        }

        // find the leftover seeds that are not used
        const leftOverSeeds: Set<number> = new Set();
        for (let i = 0; i < this.competitors.size; i++) {
          leftOverSeeds.add(i + 1);
        }
        for (let i = 0; i < seeding.length; i++) {
          if (seeding[i] != null) {
            if (leftOverSeeds.has(seeding[i])) {
              leftOverSeeds.delete(seeding[i]);
            } else {
              throw new TournamentError(
                `Duplicate seeds are not allowed. There are duplicate seeds of ${seeding[i]}`
              );
            }
          }
        }
        let leftOverSeedsArr = Array.from(leftOverSeeds);
        leftOverSeedsArr = this.shuffle(leftOverSeedsArr);

        // setup the stats
        this.competitors.forEach((player, index) => {
          const seed = seeding[index];
          const playerStat = {
            player: player,
            wins: 0,
            losses: 0,
            matchesPlayed: 0,
            seed: seed != null ? seed : leftOverSeedsArr.shift(),
            rank: 1,
          };
          this.state.playerStats.set(player.tournamentID.id, playerStat);
        });
        break;
      }
    }
    const pow = Math.ceil(Math.log2(this.competitors.size));
    const round = Math.pow(2, pow);
    this.state.currentRound = round;
    // generate rounds to play
    this.generateFirstRounds();
    this.status = Tournament.Status.INITIALIZED;
  }

  private generateFirstRounds() {
    // get players in order of seed
    const round = this.state.currentRound;
    const seededArr = Array.from(this.state.playerStats).sort(
      (a, b) => a[1].seed - b[1].seed
    );
    // 1 goes against round, 2 goes against round - 1...
    for (let i = 0; i < round / 2; i++) {
      const p1 = seededArr[i][1].player;
      const oseed = round - (i + 1);
      let p2: Player = null; // a null is a bye
      if (seededArr.length > oseed) {
        p2 = seededArr[oseed][1].player;
      }
      this.matchQueue.push([p1.tournamentID.id, p2.tournamentID.id]);

      // hashes are of the form `betterseed,worseseed`, which has a 1-1 bijection with the match that should be played
      // in a elimination tournament. e.g 8,9 is a matchup that can happen is during the round of (8 + 9 - 1) = 16
      this.matchHashes.push(`${i + 1},${oseed + 1}`);
    }
  }

  private generateRound() {
    const oldRound = this.state.currentRound;
    const nextRound = Math.floor(oldRound / 2);

    // generate new hashes
    const hashes: Array<Array<number>> = [];
    for (let i = 0; i < nextRound / 2; i++) {
      const oseed = nextRound - (i + 1);
      hashes.push([i + 1, oseed + 1]);
    }
    // for each hash is a new match to queue up, find the winners from the previous rounds
    for (let i = 0; i < hashes.length; i++) {
      const hash = hashes[i];
      // we can generate the match right before this one in the winners bracket through simple arithmetic
      // and knowing that each hash[i] represents the better seed as it is in the next round
      const oldOpponent1 = oldRound - hash[0] + 1;
      const res1 = this.state.resultsMap.get(`${hash[0]},${oldOpponent1}`);
      const p1 = res1.winner;

      const oldOpponent2 = oldRound - hash[1] + 1;
      const res2 = this.state.resultsMap.get(`${hash[1]},${oldOpponent2}`);
      const p2 = res2.winner;
      this.matchHashes.push(`${hash[0]},${hash[1]}`);
      this.matchQueue.push([p1.tournamentID.id, p2.tournamentID.id]);
    }
    this.state.currentRound = nextRound;
  }

  /**
   * Performs a Fisher Yates Shuffle
   * @param arr - the array to shuffle
   */
  private shuffle(arr: any[]) {
    for (let i = arr.length - 1; i >= 1; i--) {
      const j = Math.floor(Math.random() * i);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  async internalAddPlayer(): Promise<void> {
    if (
      this.status === Tournament.Status.INITIALIZED ||
      this.status === Tournament.Status.RUNNING
    )
      throw new TournamentError(
        'You are not allowed to add a player during the middle or after initialization of elimination tournaments'
      );
  }
  async updatePlayer(): Promise<void> {
    throw new TournamentError(
      'You are not allowed to update a player during elimination tournaments'
    );
  }
}

/**
 * The Elimination Tournament namespace
 */
export namespace Elimination {
  /**
   * Configuration interface for Elimination Tournaments
   */
  export interface Configs extends Tournament.TournamentTypeConfig {
    /**
     * Number of times the elimination tournament runs
     * @default `2`
     */
    times: number;
    /**
     * Number of times a player can lose before being eliminated. Can be 1 for single elimination. 2 for double
     * elimination is not implemented yet
     * @default `1`
     */
    lives: 1;

    /**
     * The seeding of the competitors in the order they are loaded.
     * When set to null, no seeds are used. When the ith array element is null, the ith competitor loaded, which has * tournament ID of i, does not have a seed.
     * @default `null`
     */
    seeding: Array<number>;
  }
  /**
   * The Elimination Tournament state, consisting of the current player statistics and past results
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
        losses: number;
        matchesPlayed: number;
        seed: number;
        rank: number;
      }
    >;

    /**
     * Stats for this Tournament in this instance. Intended to be constant memory usage
     */
    statistics: {
      totalMatches: number;
    };

    currentRound: number;

    /**
     * A match hash in the tournament indicating what seeds are meant to compete against each other.
     * This maps a match hash to the result at the part of the tournament, indicating who won and lost
     */
    resultsMap: Map<string, { winner: Player; loser: Player }>;
  }
}
