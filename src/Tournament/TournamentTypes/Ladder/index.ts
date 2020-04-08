import { Tournament, Bot } from "../../";
import { DeepPartial } from "../../../utils/DeepPartial";
import { Design } from "../../../Design";
import { deepMerge } from "../../../utils/DeepMerge";
import { FatalError } from "../../../DimensionError";
import { agentID } from "../../../Agent";
import trueskill from "trueskill";
import LadderState = Tournament.LadderState;
import LadderConfigs = Tournament.LadderConfigs;

import RANK_SYSTEM = Tournament.RANK_SYSTEM;
import { sprintf } from 'sprintf-js';
import { LoggerLEVEL } from "../../../Logger";

export class LadderTournament extends Tournament {
  configs: Tournament.TournamentConfigs<LadderConfigs> = {
    defaultMatchConfigs: {},
    type: Tournament.TOURNAMENT_TYPE.ELIMINATION,
    rankSystem: null,
    rankSystemConfigs: null,
    tournamentConfigs: {
      maxConcurrentMatches: 1,
      endDate: null
    },
    resultHandler: null,
    agentsPerMatch: [2],
    consoleDisplay: true
  }
  state: LadderState = {
    botStats: new Map(),
    currentRanks: [],
    results: [],
    statistics: {
      totalMatches: 0
    }
  };;

  // queue of the results to process. Use of queue avoids asynchronous editing of bot stats such as 
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
  public getRankings(): Array<{bot: Bot, name: string, id: number, matchesPlayed: number, rankState: any}> {
    let rankings = [];
    switch(this.configs.rankSystem) {
      case RANK_SYSTEM.TRUESKILL:
        this.state.botStats.forEach((stat) => {
          let rankState = <RANK_SYSTEM.TrueSkillRankState>stat.rankState;
          rankings.push({
            bot: stat.bot,
            name: stat.bot.tournamentID.name,
            id: stat.bot.tournamentID.id,
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
    this.log.info('Running Tournament with competitors: ', this.competitors.map((bot) => bot.tournamentID.name));
    this.configs = deepMerge(this.configs, configs);
    this.initialize();
    this.schedule();
    this.tourneyRunner();
  }

  private tourneyRunner() {
    
    if (this.configs.tournamentConfigs.endDate) { 
      let currDate = new Date();
      if (currDate.getTime() > this.configs.tournamentConfigs.endDate.getTime()) {
        this.log.info('Reached past Tournament marked End Date, shutting down tournament and returning final results')
        // stop the tournament
        this.stop();
        return;
      }
    }
    if (this.configs.consoleDisplay) {
      this.printTournamentStatus();
    }
    let matchPromises = [];

    // if too little matches, schedule another set
    if (this.matchQueue.length < 3) {
      this.schedule();
    }
    for (let i = 0; i < Math.min(this.matchQueue.length, this.configs.tournamentConfigs.maxConcurrentMatches); i++) {
      let matchInfo = this.matchQueue.shift();
      matchPromises.push(this.handleMatch(matchInfo));
    }
    Promise.all(matchPromises).then(() => {
      this.tourneyRunner();
    }).catch((error) => {
      this.log.error(error);
    });
  }

  private initialize() {
    this.state.botStats = new Map();
    this.state.results = [];
    switch(this.configs.rankSystem) {
      case RANK_SYSTEM.TRUESKILL:
        this.competitors.forEach((bot) => {
          this.state.botStats.set(bot.tournamentID.id, {
            bot: bot,
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
  }
  /**
   * Intended Matchmaking Algorithm Heuristics:
   * 1. Pair bots with similar scores (sigma - K * mu)
   * 2. Pair similar varianced bots (similar mu)
   * For now, we do random pairing
   */
  private schedule() {
    const matchCount = 2;
    // runs a round of scheduling
    // for every bot, we schedule some m matches (TODO: configurable)
    let rankings = this.getRankings();
    for (let i = 0; i < matchCount; i++) {
      rankings.forEach((info) => {
        let competitorCount = this.selectRandomAgentAmountForMatch();
        let random = this.selectRandomBotsFromArray(rankings, competitorCount - 1).map((info) => info.bot);
        this.matchQueue.push([info.bot, ...random]);
      })
    }
    this.competitors.forEach((bot) => {
      // let rankState = <RANK_SYSTEM.TrueSkillRankState>this.state.botStats.get(bot.tournamentID.id).rankState;

    });
  }

  private selectRandomAgentAmountForMatch(): number {
    return this.configs.agentsPerMatch[Math.floor(Math.random() * this.configs.agentsPerMatch.length)];
  }
  private selectRandomBotsFromArray(arr, num: number) {
    let r = [];
    for (let i = 0; i < num; i++) {
      r.push(arr[Math.floor(Math.random() * arr.length)]);
    }
    return r;
  }

  private printTournamentStatus() {
    if (this.log.level > LoggerLEVEL.NONE) {
      console.clear();
      console.log(this.log.bar())
      console.log(`Tournament: ${this.name} | Status: ${this.status} | Competitors: ${this.competitors.length} | Rank System: ${this.configs.rankSystem}\n`);
      console.log('Total Matches: ' + this.state.statistics.totalMatches);
      let ranks = this.getRankings();
      switch(this.configs.rankSystem) {
        case RANK_SYSTEM.TRUESKILL:
          console.log(sprintf(
            `%-10s | %-8s | %-15s | %-18s | %-8s`.underline, 'Name', 'ID', 'Score=(μ - 3σ)', 'Mu: μ, Sigma: σ', 'Matches'));
          ranks.forEach((info) => {
            console.log(sprintf(
              `%-10s`.blue+ ` | %-8s | ` + `%-15s`.green + ` | ` + `μ=%-6s, σ=%-6s`.yellow +` | %-8s`, info.bot.tournamentID.name, info.bot.tournamentID.id, info.rankState.score.toFixed(7), info.rankState.mu.toFixed(3), info.rankState.sigma.toFixed(3), info.matchesPlayed));
          });
          break;
        case RANK_SYSTEM.ELO:
          break;
      }
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
   * Handles the start and end of a match, and updates state accrding to match results and the given result handler
   * @param matchInfo 
   */
  private async handleMatch(matchInfo: Array<Bot>) {
    this.log.info('Running match - Competitors: ', matchInfo.map((bot) => {return {name: bot.tournamentID.name, rankState: this.state.botStats.get(bot.tournamentID.id).rankState}}));
    let matchRes = await this.runMatch(matchInfo);
    // update total matches
    this.state.statistics.totalMatches++;
    // update matches played per bot
    matchInfo.map((bot) => {
      let oldBotStat = this.state.botStats.get(bot.tournamentID.id);
      oldBotStat.matchesPlayed++;
      this.state.botStats.set(bot.tournamentID.id, oldBotStat);
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
    let result = <RANK_SYSTEM.TrueSkillResults>toProcess.result;
    let ranksAndSkillsOfBots: Array<{skill: Array<number>, rank: number, tournamentID: Tournament.ID}> = [];
    result.ranks.forEach((rank) => {
      let tournamentID = mapAgentIDtoTournamentID.get(rank.agentID);
      let currentBotStats = this.state.botStats.get(tournamentID.id);
      let currRankState = <RANK_SYSTEM.TrueSkillRankState>currentBotStats.rankState;
      ranksAndSkillsOfBots.push({
        skill: [currRankState.mu, currRankState.sigma], rank: rank.rank, tournamentID: tournamentID
      });
    });
    trueskill.AdjustPlayers(ranksAndSkillsOfBots);
    ranksAndSkillsOfBots.forEach((botInfo) => {
      let currentBotStats = this.state.botStats.get(botInfo.tournamentID.id);
      (<RANK_SYSTEM.TrueSkillRankState>(currentBotStats.rankState)).mu = botInfo.skill[0];
      (<RANK_SYSTEM.TrueSkillRankState>(currentBotStats.rankState)).sigma = botInfo.skill[1];
      this.state.botStats.set(botInfo.tournamentID.id, currentBotStats);
    });
  }

  private handleMatchWithELO() {

  }
}
