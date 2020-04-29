import { Tournament, Player } from "../../";
import { DeepPartial } from "../../../utils/DeepPartial";
import { Design } from '../../../Design';
import { deepMerge } from "../../../utils/DeepMerge";
import { FatalError, MatchDestroyedError } from "../../../DimensionError";
import { Agent } from "../../../Agent";
import { Rating, rate, quality } from "ts-trueskill";
import LadderState = Tournament.Ladder.State;
import LadderConfigs = Tournament.Ladder.Configs;

import RANK_SYSTEM = Tournament.RANK_SYSTEM;
import { sprintf } from 'sprintf-js';
import { Logger } from "../../../Logger";
import { ELOSystem, ELORating } from "../../ELO";

export class LadderTournament extends Tournament {
  configs: Tournament.TournamentConfigs<LadderConfigs> = {
    defaultMatchConfigs: {},
    type: Tournament.TOURNAMENT_TYPE.ELIMINATION,
    rankSystem: null,
    rankSystemConfigs: null,
    tournamentConfigs: {
      maxConcurrentMatches: 1,
      endDate: null,
      storePastResults: true,
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
  };

  private elo: ELOSystem;

  // queue of the results to process
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
        // check if other settings are valid
        if (!(this.configs.agentsPerMatch.length === 1 && this.configs.agentsPerMatch[0] === 2)) {
          throw new FatalError('We currently only support ranking matches with 2 agents under the ELO system');
        }

        // set default rank system configs
        let eloConfigs: RANK_SYSTEM.ELO.Configs = {
          startingScore: 1000,
          kFactor: 32
        }
        if (this.configs.rankSystemConfigs === null) {
          this.configs.rankSystemConfigs = eloConfigs
        }
        this.elo = new ELOSystem(this.configs.rankSystemConfigs.kFactor, this.configs.rankSystemConfigs.startingScore)
        break;
      default:
        throw new FatalError('We currently do not support this rank system for ladder tournaments');
    }


    this.configs = deepMerge(this.configs, tournamentConfigs);

    // add all players
    files.forEach((file) => {
      this.addplayer(file);
    });

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
        this.state.playerStats.forEach((stat) => {
          let rankState = <RANK_SYSTEM.ELO.RankState>stat.rankState;
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
    this.log.info('Stopping Tournament...');
    this.status = Tournament.TournamentStatus.STOPPED;
  }
  
  /**
   * Resumes the tournament if it was stopped.
   */
  public async resume() {
    // TODO: Add error check for when tournament is already running
    this.log.info('Resuming Tournament...');
    this.status = Tournament.TournamentStatus.RUNNING;
    this.tourneyRunner();
  }

  /**
   * Begin the tournament. Resolves once the tournament is started
   * @param configs - tournament configurations to use
   */
  public async run(configs?: DeepPartial<Tournament.TournamentConfigs<LadderConfigs>>) {
    
    this.log.info('Running Tournament with competitors: ', this.competitors.map((player) => player.tournamentID.name));
    this.configs = deepMerge(this.configs, configs);
    this.initialize();
    this.schedule();
    this.status = Tournament.TournamentStatus.RUNNING;
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
      if (error instanceof MatchDestroyedError) {
        // keep running even if a match is destroyed and the tournament is marked as to keep running
        if (this.status == Tournament.TournamentStatus.RUNNING) {
          this.tourneyRunner();
        }
      }
    });
  }
  
  private initializeTrueskillPlayerStats(player: Player) {
    let trueskillConfigs: RANK_SYSTEM.TRUESKILL.Configs = this.configs.rankSystemConfigs;
    this.state.playerStats.set(player.tournamentID.id, {
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
    });
  }
  private initializeELOPlayerStats(player: Player) {
    let eloConfigs: RANK_SYSTEM.ELO.Configs = this.configs.rankSystemConfigs;
    this.state.playerStats.set(player.tournamentID.id, {
      player: player,
      wins: 0,
      ties: 0,
      losses: 0,
      matchesPlayed: 0,
      rankState: {
        rating: this.elo.createRating()
      }
    });
  }
  private initialize() {
    this.state.playerStats = new Map();
    this.state.results = [];
    switch(this.configs.rankSystem) {
      case RANK_SYSTEM.TRUESKILL:
        this.competitors.forEach((player) => {
          this.initializeTrueskillPlayerStats(player);
        });
        break;
      case RANK_SYSTEM.ELO:
        this.competitors.forEach((player) => {
          this.initializeELOPlayerStats(player);
        });
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
  }

  private selectRandomAgentAmountForMatch(): number {
    return this.configs.agentsPerMatch[Math.floor(Math.random() * this.configs.agentsPerMatch.length)];
  }

  // using resovoir sampling to select num distinct randomly
  private selectRandomplayersFromArray(arr, num: number, excludedSet: Set<number> = new Set()) {
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
  internalAddPlayer(player: Player) {
    switch(this.configs.rankSystem) {
      case RANK_SYSTEM.TRUESKILL:
        this.initializeTrueskillPlayerStats(player);
        break;
      case RANK_SYSTEM.ELO:
        this.initializeELOPlayerStats(player);
      break;
    }
  }

  updatePlayer(player: Player, oldname: string, oldfile: string) {
    let playerStats = this.state.playerStats.get(player.tournamentID.id);
    switch(this.configs.rankSystem) {
      case RANK_SYSTEM.ELO: {
        let rankSystemConfigs = <RANK_SYSTEM.ELO.Configs>this.configs.rankSystemConfigs;
        let currState = <RANK_SYSTEM.ELO.RankState>playerStats.rankState;
        
        // TODO: Give user option to define how to reset score
        currState.rating.score = rankSystemConfigs.startingScore;
        break;
      }
      case RANK_SYSTEM.TRUESKILL: {
        let rankSystemConfigs = <RANK_SYSTEM.TRUESKILL.Configs>this.configs.rankSystemConfigs;
        let currState = <RANK_SYSTEM.TRUESKILL.RankState>playerStats.rankState;
        

        // TODO: Give user option to define how to reset score
        currState.rating = new Rating(rankSystemConfigs.initialMu, rankSystemConfigs.initialSigma)
        break;
      }
    }
    playerStats.matchesPlayed = 0;
    playerStats.losses = 0;
    playerStats.wins = 0;
    playerStats.ties = 0;
  }

  private printTournamentStatus() {
    if (this.log.level > Logger.LEVEL.NONE) {
      console.clear();
      console.log(this.log.bar())
      console.log(`Tournament: ${this.name} \nStatus: ${this.status} | Competitors: ${this.competitors.length} | Rank System: ${this.configs.rankSystem}\n`);
      console.log('Total Matches: ' + this.state.statistics.totalMatches + ' | Matches Queued: '  + this.matchQueue.length);
      let ranks;
      switch(this.configs.rankSystem) {
        case RANK_SYSTEM.TRUESKILL:
          ranks = this.getRankings();
          console.log(sprintf(
            `%-30s | %-8s | %-15s | %-18s | %-8s`.underline, 'Name', 'ID', 'Score=(μ - 3σ)', 'Mu: μ, Sigma: σ', 'Matches'));
          ranks.forEach((info) => {
            console.log(sprintf(
              `%-30s`.blue+ ` | %-8s | ` + `%-15s`.green + ` | ` + `μ=%-6s, σ=%-6s`.yellow +` | %-8s`, info.player.tournamentID.name, info.player.tournamentID.id, info.rankState.score.toFixed(7), info.rankState.rating.mu.toFixed(3), info.rankState.rating.sigma.toFixed(3), info.matchesPlayed));
          });
          break;
        case RANK_SYSTEM.ELO:
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
        // push to result processing queue
        this.resultProcessingQueue.push(
          {result: resInfo, mapAgentIDtoTournamentID: matchRes.match.mapAgentIDtoTournamentID});
        this.handleMatchWithELO();
        break;
    }
    if (this.configs.tournamentConfigs.storePastResults) {
      this.state.results.push(matchRes.results);
    }
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

  private async handleMatchWithELO() {
    let toProcess = this.resultProcessingQueue.shift();
    let mapAgentIDtoTournamentID = toProcess.mapAgentIDtoTournamentID;
    let result = <RANK_SYSTEM.ELO.Results>toProcess.result;
    let ratingsToChange: Array<ELORating> = [];
    let ranks = [];
    result.ranks.forEach((rankInfo) => {
      let tournamentID = mapAgentIDtoTournamentID.get(rankInfo.agentID);
      let currentplayerStats = this.state.playerStats.get(tournamentID.id);
      let currRankState = <RANK_SYSTEM.ELO.RankState>currentplayerStats.rankState;
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
