import { Tournament, Player } from "../../";
import { DeepPartial } from "../../../utils/DeepPartial";
import { Design } from "../../../Design";
import { deepMerge } from "../../../utils/DeepMerge";
import EliminationState = Tournament.Elimination.State;
import EliminationConfigs = Tournament.Elimination.Configs;

import RANK_SYSTEM = Tournament.RANK_SYSTEM;
import { FatalError } from "../../../DimensionError";
import { Agent } from "../../../Agent";

export class EliminationTournament extends Tournament {
  configs: Tournament.TournamentConfigs<EliminationConfigs> = {
    defaultMatchConfigs: {},
    type: Tournament.TOURNAMENT_TYPE.ELIMINATION,
    rankSystem: null,
    rankSystemConfigs: null,
    tournamentConfigs: {
      times: 1,
      lives: 1,
      seeding: null
    },
    resultHandler: null,
    agentsPerMatch: [2],
    consoleDisplay: true
  }
  state: EliminationState = {
    playerStats: new Map(),
    statistics: {
      totalMatches: 0
    },
    currentRound: null,
    results: [],
    resultsMap: new Map()
  };
  matchHashes: Array<string> = [];
  constructor(
    design: Design,
    files: Array<string> | Array<{file: string, name:string}>, 
    tournamentConfigs: Tournament.TournamentConfigsBase,
    id: number
  ) {
    super(design, files, id, tournamentConfigs);
    if (tournamentConfigs.consoleDisplay) {
      this.configs.consoleDisplay = tournamentConfigs.consoleDisplay;
    }
    this.configs = deepMerge(this.configs, tournamentConfigs);
    switch(tournamentConfigs.rankSystem) {
      case RANK_SYSTEM.WINS:
        // set default rank system configs
        let winsConfigs: RANK_SYSTEM.WINS.Configs = {
          winValue: 3,
          lossValue: 0,
          tieValue: 0,
          descending: true
        }
        if (this.configs.rankSystemConfigs === null) {
          this.configs.rankSystemConfigs = winsConfigs
        }
        break;
      case RANK_SYSTEM.ELO:
        break;
      default:
        throw new FatalError('We currently do not support this rank system for ladder tournaments');
    }
  }
  public getConfigs(): Tournament.TournamentConfigs<EliminationConfigs> {
    return this.configs;
  }
  public setConfigs(configs: DeepPartial<Tournament.TournamentConfigs<EliminationConfigs>> = {}) {
    this.configs = deepMerge(this.configs, configs);
  }
  public getRankings() {
    let ranks = Array.from(this.state.playerStats).sort((a, b) => a[1].rank - b[1].rank);
    return ranks.map((a) => a[1]);
  }
  public async stop() {

  }
  public async resume() {
    
  }
  public async run(configs?: DeepPartial<Tournament.TournamentConfigs<EliminationConfigs>>) {
    this.configs = deepMerge(this.configs, configs);
    this.initialize();

    return new Promise(async (resolve) => {
      // running one at a time
      while (this.matchQueue.length) {
        let matchInfo = this.matchQueue.shift();
        let matchHash = this.matchHashes.shift();
        await this.handleMatch(matchInfo, matchHash);        
        if (this.state.currentRound === 2) {
          break;
        }
        if (this.matchQueue.length === 0) {
          // once a round is done, perform the next round
          this.generateRound();
        }
      }
      resolve(this.state);
    })
  }

  /**
   * Handles a match and updates stats appropriately
   * @param matchInfo - The match to run
   */
  private async handleMatch(matchInfo: Array<Player>, matchHash: string) {
    if (matchInfo.length != 2) {
      throw new FatalError(`This shouldn't happen, tried to run a match with player count not equal to 2 in an elimination tournament`);
    }
    // deal wiht case when one is a null
    if (matchInfo[0] == null) {
      let winner = matchInfo[1];
      // store result into with matchHash key
      this.state.resultsMap.set(matchHash, {winner: winner, loser: null});
      return;
    }
    else if (matchInfo[1] == null) {
      let winner = matchInfo[0];
      // store result into with matchHash key
      this.state.resultsMap.set(matchHash, {winner: winner, loser: null});
      return;
    }


    this.log.detail('Running match - Competitors: ', matchInfo.map((player) => {return player.tournamentID.name}));
    let matchRes = await this.runMatch(matchInfo);
    let res: RANK_SYSTEM.WINS.Results = this.configs.resultHandler(matchRes.results);
    this.state.results.push(res);
    this.state.statistics.totalMatches++;

    let rankSystemConfigs: RANK_SYSTEM.WINS.Configs = this.configs.rankSystemConfigs;
    // maps tournament ID to scores
    let parsedRes = {};
    let p0ID = matchInfo[0].tournamentID.id;
    let p1ID = matchInfo[1].tournamentID.id;
    parsedRes[p0ID] = 0;
    parsedRes[p1ID] = 0;

    // update scores based on winners, ties, and losers
    res.winners.forEach((winnerID: Agent.ID) => {
      let tournamentID = matchRes.match.mapAgentIDtoTournamentID.get(winnerID);
      parsedRes[tournamentID.id]+= rankSystemConfigs.winValue;
    });
    res.ties.forEach((winnerID: Agent.ID) => {
      let tournamentID = matchRes.match.mapAgentIDtoTournamentID.get(winnerID);
      parsedRes[tournamentID.id]+= rankSystemConfigs.tieValue;
    });
    res.losers.forEach((winnerID: Agent.ID) => {
      let tournamentID = matchRes.match.mapAgentIDtoTournamentID.get(winnerID);
      parsedRes[tournamentID.id]+= rankSystemConfigs.lossValue;
    });

    // using scores, determine winner
    let winner = this.state.playerStats.get(p0ID);
    let loser = this.state.playerStats.get(p1ID);
    if (parsedRes[p0ID] > parsedRes[p1ID]) {
    }
    else if (parsedRes[p0ID] < parsedRes[p1ID]) {
      winner = this.state.playerStats.get(p1ID);
      loser = this.state.playerStats.get(p0ID);
    }
    else {
      // randomly decide who gets to win because score was tied
    }
    // update stats
    winner.wins++;
    winner.matchesPlayed++;
    loser.losses++;
    loser.matchesPlayed++;
    loser.rank = this.state.currentRound;

    // store result into with matchHash key
    this.state.resultsMap.set(matchHash, {winner: winner.player, loser: loser.player});
  }

  private initialize() {
    this.state.playerStats = new Map();
    this.state.results = [];
    switch(this.configs.rankSystem) {
      case RANK_SYSTEM.WINS:
        let configs: RANK_SYSTEM.WINS.Configs = this.configs.rankSystemConfigs;

        // set up the seeding array
        let seeding = this.configs.tournamentConfigs.seeding;
        if (seeding == null) seeding = [];
        for (let i = 0; i < this.competitors.length - seeding.length; i++) {
          seeding.push(null);
        }

        // find the leftover seeds that are not used
        let leftOverSeeds: Set<number> = new Set();
        for (let i = 0; i < this.competitors.length; i++) {
          leftOverSeeds.add(i + 1);
        }
        for (let i = 0; i < seeding.length; i++) {
          if (seeding[i] != null) {
            if (leftOverSeeds.has(seeding[i])) {
              leftOverSeeds.delete(seeding[i]);
            }
            else {
              throw new FatalError(`Duplicate seeds are not allowed. There are duplicate seeds of ${seeding[i]}`);
            }
          }
        }
        let leftOverSeedsArr = Array.from(leftOverSeeds);
        leftOverSeedsArr = this.shuffle(leftOverSeedsArr);

        // setup the stats
        this.competitors.forEach((player, index) => {
          let seed = seeding[index];
          let playerStat = {
            player: player,
            wins: 0,
            losses: 0,
            matchesPlayed: 0,
            seed: seed != null ? seed : leftOverSeedsArr.shift(),
            rank: 1
          }
          this.state.playerStats.set(player.tournamentID.id, playerStat);
        });
        break;
    }
    let pow = Math.ceil(Math.log2(this.competitors.length));
    let round = Math.pow(2, pow);
    this.state.currentRound = round;
    // generate rounds to play
    this.generateFirstRounds();
  }

  private generateFirstRounds() {
    // while(round > 0) {
    //   this.state.roundsToPlay.push({round: round, lives: 0});
    //   round = Math.floor(round / 2);
    // }
    // get players in order of seed
    let round = this.state.currentRound;
    let seededArr = Array.from(this.state.playerStats).sort((a, b) => a[1].seed - b[1].seed);
    // 1 goes against round, 2 goes against round - 1...
    for (let i = 0; i < round / 2; i++) {
      let p1 = seededArr[i][1].player;
      let oseed = round - (i + 1);
      let p2 = null; // a null is a bye
      if (seededArr.length > oseed) {
        p2 = seededArr[oseed][1].player;
      }
      this.matchQueue.push([p1, p2]);
      this.matchHashes.push(`${i+1},${oseed + 1}`);
    }
  }

  private generateRound() {
    let oldRound = this.state.currentRound;
    let nextRound = Math.floor(oldRound / 2);

    // generate new hashes
    let hashes: Array<Array<number>> = [];
    for (let i = 0; i < nextRound / 2; i++) {
      let oseed = nextRound - (i + 1);
      hashes.push([i+1, oseed+1]);
      // this.matchHashes.push(`${i + 1}, ${oseed + 1}`);
    }
    // for each hash is a new match to queue up, find the winners from the previous rounds
    for (let i = 0; i < hashes.length; i++) {
      let hash = hashes[i];
      let oldOpponent1 = oldRound - hash[0] + 1;
      let res1 = this.state.resultsMap.get(`${hash[0]},${oldOpponent1}`);
      let p1 = res1.winner;

      let oldOpponent2 = oldRound - hash[1] + 1;
      let res2 = this.state.resultsMap.get(`${hash[1]},${oldOpponent2}`);
      let p2 = res2.winner;
      this.matchHashes.push(`${hash[0]},${hash[1]}`);
      this.matchQueue.push([p1, p2]);

    }
    this.state.currentRound = nextRound;

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
}
