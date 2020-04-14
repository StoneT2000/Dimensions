import { Tournament, Player, } from "../../";
import { DeepPartial } from "../../../utils/DeepPartial";
import { Design } from '../../../Design';
import { deepMerge } from "../../../utils/DeepMerge";
import { FatalError } from "../../../DimensionError";
import { Agent } from "../../../Agent";
import { Logger } from "../../../Logger";
import RANK_SYSTEM = Tournament.RANK_SYSTEM;
import { sprintf } from 'sprintf-js';
/**
 * The Round Robin Tournament Class
 * 
 * Only supports two agent matches at the moment
 */
export class RoundRobinTournament extends Tournament {
  configs: Tournament.TournamentConfigs<Tournament.RoundRobin.Configs> = {
    defaultMatchConfigs: {},
    type: Tournament.TOURNAMENT_TYPE.ROUND_ROBIN,
    rankSystem: null,
    rankSystemConfigs: null,
    tournamentConfigs: {
      times: 2,
    },
    agentsPerMatch: [2],
    resultHandler: null,
    consoleDisplay: true
  }
  public state: Tournament.RoundRobin.State = {
    playerStats: new Map(),
    results: [],
    statistics: {
      totalMatches: 0
    }
  };
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

    // handle config defaults
    if (tournamentConfigs.rankSystem !== Tournament.RANK_SYSTEM.WINS) {
      throw new FatalError('We currently do not support Round Robin tournaments with ranking system other than wins system');
    }
    for (let i = 0; i < tournamentConfigs.agentsPerMatch.length; i++) {
      if (tournamentConfigs.agentsPerMatch[i] != 2)
        throw new FatalError('We currently only support 2 agents per match for Round Robin ');
    }
    if (!tournamentConfigs.rankSystemConfigs) {
      this.configs.rankSystemConfigs = {
        winValue: 3,
        tieValue: 1,
        lossValue: 0,
        ascending: false
      };
    }

    // TODO we need to type check the result handler and see if it is correct. Throw a error if handler is of wrong format at runtime somehow

    // handle rest
    this.configs = deepMerge(this.configs, tournamentConfigs);

    this.status = Tournament.TournamentStatus.INITIALIZED;
    this.log.info('Initialized Round Robin Tournament');
  }

  public async run(configs?: DeepPartial<Tournament.TournamentConfigs<Tournament.RoundRobin.Configs>>) {
    this.status = Tournament.TournamentStatus.RUNNING;
    this.log.info('Running Tournament with competitors: ', this.competitors.map((player) => player.tournamentID.name));
    this.configs = deepMerge(this.configs, configs);
    this.initialize();
    this.schedule();

    return new Promise(async (resolve) => {
      // running one at a time
      while (this.matchQueue.length) {
        let matchInfo = this.matchQueue.shift();
        await this.handleMatch(matchInfo);        

      }
      resolve(this.state);
    })
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
    
    this.log.detail('Running match - Competitors: ', matchInfo.map((player) => player.tournamentID.name));
    let matchRes = await this.runMatch(matchInfo);
    let resInfo = <Tournament.RANK_SYSTEM.WINS.Results>this.configs.resultHandler(matchRes.results);
    this.state.results.push(matchRes.results);
    
    // update total matches
    this.state.statistics.totalMatches++;
    // update matches played per player
    matchInfo.map((player) => {
      let oldplayerStat = this.state.playerStats.get(player.tournamentID.id);
      oldplayerStat.matchesPlayed++;
      this.state.playerStats.set(player.tournamentID.id, oldplayerStat);
    })

    // handle winners, tied, and losers players and update their stats
    resInfo.winners.forEach((winnerID: Agent.ID) => {
      // resInfo contains agentIDs, which need to be remapped to tournament IDs
      let tournamentID = matchRes.match.mapAgentIDtoTournamentID.get(winnerID);
      let oldplayerStat = this.state.playerStats.get(tournamentID.id);
      oldplayerStat.wins++;
      this.state.playerStats.set(tournamentID.id, oldplayerStat);
    });
    resInfo.ties.forEach((tieplayerID: Agent.ID) => {
      let tournamentID = matchRes.match.mapAgentIDtoTournamentID.get(tieplayerID);
      let oldplayerStat = this.state.playerStats.get(tournamentID.id);
      oldplayerStat.ties++;
      this.state.playerStats.set(tournamentID.id, oldplayerStat);
    });
    resInfo.losers.forEach((loserplayerID: Agent.ID) => {
      let tournamentID = matchRes.match.mapAgentIDtoTournamentID.get(loserplayerID);
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

  public async stop() {

  }
  public async resume() {
    
  }

  // TODO: move sorting to run function. It's ok too sort like this for small leagues, but larger will become slow.
  public getRankings() {
    let ranks = [];
    this.state.playerStats.forEach((playerStat) => {
      let score = playerStat.wins * this.configs.rankSystemConfigs.winValue +
      playerStat.ties * this.configs.rankSystemConfigs.tieValue +
      playerStat.losses * this.configs.rankSystemConfigs.lossValue;
      ranks.push(
        {
          player: playerStat.player, 
          name: playerStat.player.tournamentID.name, 
          id: playerStat.player.tournamentID.id, 
          score: score,
          wins: playerStat.wins,
          losses: playerStat.losses,
          ties: playerStat.ties,
          matchesPlayed: playerStat.matchesPlayed
        });
    });
    if (this.configs.rankSystemConfigs.ascending) {
      ranks.sort((a, b) => {
        return b.score - a.score
      });
    }
    else {
      ranks.sort((a, b) => {
        return a.score - b.score
      });
    }
    return ranks;
  }
  public getConfigs(): Tournament.TournamentConfigs<Tournament.RoundRobin.Configs> {
    return this.configs;
  }
  public setConfigs(configs: DeepPartial<Tournament.TournamentConfigs<Tournament.RoundRobin.Configs>> = {}) {
    this.configs = deepMerge(this.configs, configs);
  }

  private initialize() {
    this.state.playerStats = new Map();
    this.state.results = [];
    this.competitors.forEach((player) => {
      this.state.playerStats.set(player.tournamentID.id, {
        player: player,
        wins: 0,
        ties: 0,
        losses: 0,
        matchesPlayed: 0
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
    let matchSets: Array<Array<Player>> = [];
    for (let i = 0; i < this.configs.tournamentConfigs.times; i++) {
      matchSets.push(...this.generateARound());
    }
    this.matchQueue = matchSets;
  }
  private generateARound() {
    let roundQueue: Array<Array<Player>> = [];
    for (let i = 0; i < this.competitors.length; i++) {
      for (let j = i + 1; j < this.competitors.length; j++) {
        let player1 = this.competitors[i];
        let player2 = this.competitors[j];
        roundQueue.push([player1, player2]);
      }
    }
    return roundQueue;
  }
  private printTournamentStatus() {
    if (this.log.level > Logger.LEVEL.NONE) {
      console.clear();
      console.log(this.log.bar())
      console.log(`Tournament: ${this.name} | Status: ${this.status} | Competitors: ${this.competitors.length} | Rank System: ${this.configs.rankSystem}\n`);
      console.log('Total Matches: ' + this.state.statistics.totalMatches);
      let ranks = this.getRankings();
      switch(this.configs.rankSystem) {
        case RANK_SYSTEM.WINS:
          console.log(sprintf(
            `%-20s | %-8s | %-15s | %-6s | %-6s | %-8s | %-8s`.underline, 'Name', 'ID', 'Score', 'Wins', 'Ties', 'Losses', 'Matches'));
          ranks.forEach((info) => {
            console.log(sprintf(
              `%-20s`.blue+ ` | %-8s | ` + `%-15s`.green + ` | %-6s | %-6s | %-8s | %-8s`, info.player.tournamentID.name, info.player.tournamentID.id, info.score.toFixed(3), info.wins, info.ties, info.losses, info.matchesPlayed));
          });
          break;
      }
    }
  }
}