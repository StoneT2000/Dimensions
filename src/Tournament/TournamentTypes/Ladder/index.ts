import { Tournament, Player } from "../../";
import { DeepPartial } from "../../../utils/DeepPartial";
import { Design } from '../../../Design';
import { deepMerge } from "../../../utils/DeepMerge";
import { FatalError } from "../../../DimensionError";
import { Agent } from "../../../Agent";
import { Rating, rate, quality } from "ts-trueskill";
import LadderState = Tournament.Ladder.State;
import LadderConfigs = Tournament.Ladder.Configs;

import RANK_SYSTEM = Tournament.RANK_SYSTEM;
import { sprintf } from 'sprintf-js';
import { Logger } from "../../../Logger";

export class LadderTournament extends Tournament {
  configs: Tournament.TournamentConfigs<LadderConfigs> = {
    defaultMatchConfigs: {},
    type: Tournament.TOURNAMENT_TYPE.ELIMINATION,
    rankSystem: null,
    rankSystemConfigs: null,
    tournamentConfigs: {
      maxConcurrentMatches: 1,
      endDate: null,
      maxTotalMatches: null
    },
    resultHandler: null,
    agentsPerMatch: [2],
    consoleDisplay: true
  }
  state: LadderState = {
    playerStats: new Map(),
    currentRanks: [],
    results: [],
    statistics: {
      totalMatches: 0
    }
  };;

  // queue of the results to process. Use of queue avoids asynchronous editing of player stats such as 
  // sigma and mu for trueskill
  resultProcessingQueue: Array<{result: any, mapAgentIDtoTournamentID: Map<Agent.ID, Tournament.ID>}> = [];

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
    switch(tournamentConfigs.rankSystem) {
      case RANK_SYSTEM.TRUESKILL:
        // set default rank system configs
        let trueskillConfigs: RANK_SYSTEM.TRUESKILL.Configs = {
          initialMu: 25,
          initialSigma: 25/3
        }
        if (this.configs.rankSystemConfigs === null) {
          this.configs.rankSystemConfigs = trueskillConfigs
        }
        break;
      case RANK_SYSTEM.ELO:
        break;
      default:
        throw new FatalError('We currently do not support this rank system for ladder tournaments');
    }


    this.configs = deepMerge(this.configs, tournamentConfigs);
    this.status = Tournament.TournamentStatus.INITIALIZED;
    this.log.info('Initialized Ladder Tournament');
  }
  public getConfigs(): Tournament.TournamentConfigs<LadderConfigs> {
    return this.configs;
  }
  public setConfigs(configs: DeepPartial<Tournament.TournamentConfigs<LadderConfigs>> = {}) {
    this.configs = deepMerge(this.configs, configs);
  }
  public getRankings(): Array<{player: Player, name: string, id: number, matchesPlayed: number, rankState: any}> {
    let rankings = [];
    switch(this.configs.rankSystem) {
      case RANK_SYSTEM.TRUESKILL:
        this.state.playerStats.forEach((stat) => {
          let rankState = <RANK_SYSTEM.TRUESKILL.RankState>stat.rankState;
          rankings.push({
            player: stat.player,
            name: stat.player.tournamentID.name,
            id: stat.player.tournamentID.id,
            matchesPlayed: stat.matchesPlayed,
            rankState: {...rankState, score: rankState.rating.mu - 3 * rankState.rating.sigma}
          });
        });
        rankings.sort((a, b) => {
          return b.rankState.score - a.rankState.score
        });
        break;
      case RANK_SYSTEM.ELO:
        break;
    }
    return rankings;
  }
  public async stop() {
    this.log.info('Stopping Tournament...');
    this.status = Tournament.TournamentStatus.STOPPED;
  }
  public async resume() {
    this.log.info('Resuming Tournament...');
    this.status = Tournament.TournamentStatus.RUNNING;
    this.tourneyRunner();
  }
  public async run(configs?: DeepPartial<Tournament.TournamentConfigs<LadderConfigs>>) {
    this.status = Tournament.TournamentStatus.RUNNING;
    this.log.info('Running Tournament with competitors: ', this.competitors.map((player) => player.tournamentID.name));
    this.configs = deepMerge(this.configs, configs);
    this.initialize();
    this.schedule();
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
      if (this.status == Tournament.TournamentStatus.RUNNING) {
        this.tourneyRunner();
      }
    }).catch((error) => {
      this.log.error(error);
    });
  }

  private initialize() {
    this.state.playerStats = new Map();
    this.state.results = [];
    switch(this.configs.rankSystem) {
      case RANK_SYSTEM.TRUESKILL:
        let trueskillConfigs: RANK_SYSTEM.TRUESKILL.Configs = this.configs.rankSystemConfigs;
        this.competitors.forEach((player) => {
          this.state.playerStats.set(player.tournamentID.id, {
            player: player,
            wins: 0,
            ties: 0,
            losses: 0,
            matchesPlayed: 0,
            rankState: {
              rating: new Rating(trueskillConfigs.initialMu, trueskillConfigs.initialSigma)
            }
          });
        });
        break;
      case RANK_SYSTEM.ELO:
        break;
    }
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
    for (let i = 0; i < matchCount; i++) {
        let competitorCount = this.selectRandomAgentAmountForMatch();
        let random = this.selectRandomplayersFromArray(this.competitors, competitorCount);
        this.matchQueue.push([...random]);
    }
    this.competitors.forEach((player) => {
      // let rankState = <RANK_SYSTEM.TrueSkillRankState>this.state.playerStats.get(player.tournamentID.id).rankState;

    });
  }

  private selectRandomAgentAmountForMatch(): number {
    return this.configs.agentsPerMatch[Math.floor(Math.random() * this.configs.agentsPerMatch.length)];
  }

  // using resovoir sampling to select num distinct randomly
  private selectRandomplayersFromArray(arr, num: number) {
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

  private printTournamentStatus() {
    if (this.log.level > Logger.LEVEL.NONE) {
      console.clear();
      console.log(this.log.bar())
      console.log(`Tournament: ${this.name} \nStatus: ${this.status} | Competitors: ${this.competitors.length} | Rank System: ${this.configs.rankSystem}\n`);
      console.log('Total Matches: ' + this.state.statistics.totalMatches + ' | Matches Queued: '  + this.matchQueue.length);
      let ranks = this.getRankings();
      switch(this.configs.rankSystem) {
        case RANK_SYSTEM.TRUESKILL:
          console.log(sprintf(
            `%-30s | %-8s | %-15s | %-18s | %-8s`.underline, 'Name', 'ID', 'Score=(μ - 3σ)', 'Mu: μ, Sigma: σ', 'Matches'));
          ranks.forEach((info) => {
            console.log(sprintf(
              `%-30s`.blue+ ` | %-8s | ` + `%-15s`.green + ` | ` + `μ=%-6s, σ=%-6s`.yellow +` | %-8s`, info.player.tournamentID.name, info.player.tournamentID.id, info.rankState.score.toFixed(7), info.rankState.rating.mu.toFixed(3), info.rankState.rating.sigma.toFixed(3), info.matchesPlayed));
          });
          break;
        case RANK_SYSTEM.ELO:
          break;
      }
      
      
    }
  }

  /**
   * Handles the start and end of a match, and updates state accrding to match results and the given result handler
   * @param matchInfo 
   */
  private async handleMatch(matchInfo: Array<Player>) {
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
      case RANK_SYSTEM.TRUESKILL:
        // push to result processing queue
        this.resultProcessingQueue.push(
          {result: resInfo, mapAgentIDtoTournamentID: matchRes.match.mapAgentIDtoTournamentID});
        // make a call to handle match with trueskill to process the next result in the processing queue
        this.handleMatchWithTrueSkill();
        break;
      case RANK_SYSTEM.ELO:
        this.handleMatchWithELO();
        break;
    }
    this.state.results.push(matchRes.results);
  }

  private async handleMatchWithTrueSkill() {
    let toProcess = this.resultProcessingQueue.shift();
    let mapAgentIDtoTournamentID = toProcess.mapAgentIDtoTournamentID;
    let result = <RANK_SYSTEM.TRUESKILL.Results>toProcess.result;
    let playerRatings: Array<Array<Rating>> = [];
    let tourneyIDs: Array<{id: Tournament.ID, stats: any}> = [];
    let ranks: Array<number> = [];
    result.ranks.sort((a, b) => a.rank - b.rank);
    result.ranks.forEach((rank) => {
      let tournamentID = mapAgentIDtoTournamentID.get(rank.agentID);
      let currentplayerStats = this.state.playerStats.get(tournamentID.id);
      let currRankState = <RANK_SYSTEM.TRUESKILL.RankState>currentplayerStats.rankState;
      playerRatings.push([currRankState.rating]);
      ranks.push(rank.rank);
      tourneyIDs.push({id: tournamentID, stats: currentplayerStats});
    });

    let newRatings = rate(playerRatings, ranks);
    tourneyIDs.forEach((info, i) => {
      let tourneyID = info.id.id;
      let currentStats = info.stats;
      (<RANK_SYSTEM.TRUESKILL.RankState>currentStats.rankState).rating = newRatings[i][0];
      this.state.playerStats.set(tourneyID, currentStats);
    })

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

  private handleMatchWithELO() {

  }
}
