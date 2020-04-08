import { Tournament, Bot, } from "../../";
import { DeepPartial } from "../../../utils/DeepPartial";
import { Design } from "../../../Design";
import { deepMerge } from "../../../utils/DeepMerge";
import { FatalError } from "../../../DimensionError";
import { agentID } from "../../../Agent";

/**
 * Round robin tournament
 * General expectations is it is always two agents only.
 */
export class RoundRobinTournament extends Tournament {
  private configs: Tournament.TournamentConfigs<Tournament.RoundRobinConfigs> = {
    defaultMatchConfigs: {},
    type: Tournament.TOURNAMENT_TYPE.ROUND_ROBIN,
    rankSystem: null,
    rankSystemConfigs: null,
    tournamentConfigs: {
      times: 1,
    },
    resultHandler: null
  }
  state: Tournament.RoundRobinState = {
    botStats: new Map(),
    results: [],
    statistics: {}
  };
  constructor(
    design: Design,
    files: Array<string> | Array<{file: string, name:string}>, 
    tournamentConfigs: Tournament.TournamentConfigsBase,
    id: number
  ) {
    super(design, files, id, tournamentConfigs.loggingLevel);

    this.name = tournamentConfigs.name ? tournamentConfigs.name : `tournament_${this.id}`;
    this.log.identifier = this.name;
    // handle config defaults
    if (tournamentConfigs.rankSystem !== Tournament.RANK_SYSTEM.WINS) {
      throw new FatalError('We currently do not support Round Robin tournamnets with ranking system other than wins system');
    }
    if (!tournamentConfigs.rankSystemConfigs) {
      this.configs.rankSystemConfigs = {
        winValue: 3,
        tieValue: 1,
        lossValue: 0,
        ascending: true
      };
    }

    // TODO we need to type check the result handler and see if it is correct. Throw a error if handler is of wrong format at runtime somehow

    // handle rest
    this.configs = deepMerge(this.configs, tournamentConfigs);
    this.log.info('Initialized Round Robin Tournament');
  }

  public async run(configs?: DeepPartial<Tournament.TournamentConfigs<Tournament.RoundRobinConfigs>>) {
    this.configs = deepMerge(this.configs, configs);
    this.initialize();
    this.schedule();

    return new Promise(async (resolve) => {
      // running one at a time
      while (this.matchQueue.length) {
        let matchInfo = this.matchQueue.shift();
        this.log.info('Running match - Competitors: ', matchInfo.map((bot) => bot.tournamentID.name));
        let matchRes = await this.runMatch(matchInfo);
        let resInfo: Tournament.RANK_SYSTEM.WinResults = this.configs.resultHandler(matchRes.results);
        this.state.results.push(matchRes.results);
        // resInfo contains agentIDs, which need to be remapped to tournament IDs
        resInfo.winners.forEach((winnerID: agentID) => {
          let tournamentID = matchRes.match.mapAgentIDtoTournamentID.get(winnerID);
          let oldBotStat = this.state.botStats.get(tournamentID.id);
          oldBotStat.wins++;
          this.state.botStats.set(tournamentID.id, oldBotStat);
        });
        resInfo.ties.forEach((tieBotID: agentID) => {
          let tournamentID = matchRes.match.mapAgentIDtoTournamentID.get(tieBotID);
          let oldBotStat = this.state.botStats.get(tournamentID.id);
          oldBotStat.ties++;
          this.state.botStats.set(tournamentID.id, oldBotStat);
        });
        resInfo.losers.forEach((loserBotID: agentID) => {
          let tournamentID = matchRes.match.mapAgentIDtoTournamentID.get(loserBotID);
          let oldBotStat = this.state.botStats.get(tournamentID.id);
          oldBotStat.losses++;
          this.state.botStats.set(tournamentID.id, oldBotStat);
        });
        

        switch(this.configs.rankSystem) {
          case Tournament.RANK_SYSTEM.WINS:

            break;
          case Tournament.RANK_SYSTEM.ELO:
            break;
        }
      }
      resolve(this.state);
    })
  }

  // TODO: move sorting to run function. It's ok too sort like this for small leagues, but larger will become slow.
  public getRankings() {
    let ranks = [];
    this.state.botStats.forEach((botStat) => {
      let score = botStat.wins * this.configs.rankSystemConfigs.winValue +
      botStat.ties * this.configs.rankSystemConfigs.tieValue +
      botStat.losses * this.configs.rankSystemConfigs.lossValue;
      ranks.push(
        {bot: botStat.bot, name: botStat.bot.tournamentID.name, id: botStat.bot.tournamentID.id, score: score});
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
  public getConfigs(): Tournament.TournamentConfigs<Tournament.RoundRobinConfigs> {
    return this.configs;
  }
  public setConfigs(configs: DeepPartial<Tournament.TournamentConfigs<Tournament.RoundRobinConfigs>> = {}) {
    this.configs = deepMerge(this.configs, configs);
  }

  private initialize() {
    this.competitors.forEach((bot) => {
      this.state.botStats.set(bot.tournamentID.id, {
        bot: bot,
        wins: 0,
        ties: 0,
        losses: 0,
      })
    })
  }
  /**
   * Queue up all matches necessary
   */
  private schedule() {
    let matchSets: Array<Array<Bot>> = [];
    for (let i = 0; i < this.configs.tournamentConfigs.times; i++) {
      matchSets.push(...this.generateARound());
    }
    this.matchQueue = matchSets;
  }
  private generateARound() {
    let roundQueue: Array<Array<Bot>> = [];
    for (let i = 0; i < this.competitors.length; i++) {
      for (let j = i + 1; j < this.competitors.length; j++) {
        let bot1 = this.competitors[i];
        let bot2 = this.competitors[j];
        roundQueue.push([bot1, bot2]);
      }
    }
    return roundQueue;
  }
}