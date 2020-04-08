import { Tournament, Player } from "../../";
import { DeepPartial } from "../../../utils/DeepPartial";
import { Design } from '../../../Design';
import { deepMerge } from "../../../utils/DeepMerge";
import { FatalError } from "../../../DimensionError";
import { agentID } from "../../../Agent";
import trueskill from "trueskill";
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
  resultProcessingQueue: Array<{result: any, mapAgentIDtoTournamentID: Map<agentID, Tournament.ID>}> = [];

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
            rankState: {...rankState, score: rankState.mu - 3 * rankState.sigma}
          })
        });
        rankings.sort((a, b) => {
          return a.rankState.score - b.rankState.score
        });
        break;
      case RANK_SYSTEM.ELO:
        break;
    }
    return rankings;
  }
  public async stop() {

  }
  public async resume() {
    
  }
  public async run(configs?: DeepPartial<Tournament.TournamentConfigs<LadderConfigs>>) {
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
    Promise.race(matchPromises).then(() => {
      this.tourneyRunner();
    }).catch((error) => {
      this.log.error(error);
    });
  }

  private initialize() {
    this.state.playerStats = new Map();
    this.state.results = [];
    switch(this.configs.rankSystem) {
      case RANK_SYSTEM.TRUESKILL:
        this.competitors.forEach((player) => {
          this.state.playerStats.set(player.tournamentID.id, {
            player: player,
            wins: 0,
            ties: 0,
            losses: 0,
            matchesPlayed: 0,
            rankState: {
              mu: 75, // TODO, make this configurable
              sigma: 25/3,
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
    let rankings = this.getRankings();
    for (let i = 0; i < matchCount; i++) {
      rankings.forEach((info) => {
        let competitorCount = this.selectRandomAgentAmountForMatch();
        let random = this.selectRandomplayersFromArray(rankings, competitorCount - 1).map((info) => info.player);
        this.matchQueue.push([info.player, ...random]);
      })
    }
    this.competitors.forEach((player) => {
      // let rankState = <RANK_SYSTEM.TrueSkillRankState>this.state.playerStats.get(player.tournamentID.id).rankState;

    });
  }

  private selectRandomAgentAmountForMatch(): number {
    return this.configs.agentsPerMatch[Math.floor(Math.random() * this.configs.agentsPerMatch.length)];
  }
  private selectRandomplayersFromArray(arr, num: number) {
    let r = [];
    for (let i = 0; i < num; i++) {
      r.push(arr[Math.floor(Math.random() * arr.length)]);
    }
    return r;
  }

  private printTournamentStatus() {
    if (this.log.level > Logger.LEVEL.NONE) {
      console.clear();
      console.log(this.log.bar())
      console.log(`Tournament: ${this.name} | Status: ${this.status} | Competitors: ${this.competitors.length} | Rank System: ${this.configs.rankSystem}\n`);
      console.log('Total Matches: ' + this.state.statistics.totalMatches + ' | Matches Queued: '  + this.matchQueue.length);
      let ranks = this.getRankings();
      switch(this.configs.rankSystem) {
        case RANK_SYSTEM.TRUESKILL:
          console.log(sprintf(
            `%-10s | %-8s | %-15s | %-18s | %-8s`.underline, 'Name', 'ID', 'Score=(μ - 3σ)', 'Mu: μ, Sigma: σ', 'Matches'));
          ranks.forEach((info) => {
            console.log(sprintf(
              `%-10s`.blue+ ` | %-8s | ` + `%-15s`.green + ` | ` + `μ=%-6s, σ=%-6s`.yellow +` | %-8s`, info.player.tournamentID.name, info.player.tournamentID.id, info.rankState.score.toFixed(7), info.rankState.mu.toFixed(3), info.rankState.sigma.toFixed(3), info.matchesPlayed));
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

  private handleMatchWithTrueSkill() {
    let toProcess = this.resultProcessingQueue.shift();
    let mapAgentIDtoTournamentID = toProcess.mapAgentIDtoTournamentID;
    let result = <RANK_SYSTEM.TRUESKILL.Results>toProcess.result;
    let ranksAndSkillsOfplayers: Array<{skill: Array<number>, rank: number, tournamentID: Tournament.ID}> = [];
    result.ranks.forEach((rank) => {
      let tournamentID = mapAgentIDtoTournamentID.get(rank.agentID);
      let currentplayerStats = this.state.playerStats.get(tournamentID.id);
      let currRankState = <RANK_SYSTEM.TRUESKILL.RankState>currentplayerStats.rankState;
      ranksAndSkillsOfplayers.push({
        skill: [currRankState.mu, currRankState.sigma], rank: rank.rank, tournamentID: tournamentID
      });
    });
    trueskill.AdjustPlayers(ranksAndSkillsOfplayers);
    ranksAndSkillsOfplayers.forEach((playerInfo) => {
      let currentplayerStats = this.state.playerStats.get(playerInfo.tournamentID.id);
      (<RANK_SYSTEM.TRUESKILL.RankState>(currentplayerStats.rankState)).mu = playerInfo.skill[0];
      (<RANK_SYSTEM.TRUESKILL.RankState>(currentplayerStats.rankState)).sigma = playerInfo.skill[1];
      this.state.playerStats.set(playerInfo.tournamentID.id, currentplayerStats);
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
  }

  private handleMatchWithELO() {

  }
}
