import { Tournament, Bot, } from "../../";
import { DeepPartial } from "../../../utils/DeepPartial";
import { Design } from "../../../Design";
import { deepMerge } from "../../../utils/DeepMerge";
import { FatalError } from "../../../DimensionError";
import { agentID } from "../../../Agent";

// Configs specific to round robin tournaments, e.g association football
export interface Configs extends Tournament.TournamentTypeConfig {
  times: number
}
export interface State extends Tournament.TournamentTypeState {
  botStats: Map<string, {bot: Bot, wins: number, ties: number, losses: number}>
  statistics: {

  }
}
/**
 * Round robin tournament
 * General expectations is it is always two agents only.
 */
export class RoundRobinTournament extends Tournament {
  configs: Tournament.TournamentConfigs<Configs> = {
    defaultMatchConfigs: {},
    type: Tournament.TOURNAMENT_TYPE.ROUND_ROBIN,
    rankSystem: null,
    rankSystemConfigs: null,
    typeConfigs: {
      times: 1,
    },
    resultHandler: null
  }
  state: State = {
    botStats: new Map(),
    statistics: {}
  };
  constructor(
    design: Design,
    files: Array<string> | Array<{file: string, name:string}>, 
    tournamentConfigs: Tournament.TournamentConfigsBase,
    id: number
  ) {
    super(design, files, id);

    // handle config defaults
    if (tournamentConfigs.rankSystem !== Tournament.RANK_SYSTEM.WINS) {
      throw new FatalError('We currently do not support Round Robin tournamnets with ranking system other than wins system');
    }
    if (!tournamentConfigs.rankSystemConfigs) {
      this.configs.rankSystemConfigs = {
        winValue: 3,
        tieValue: 1,
        lossValue: 0
      };
    }

    // TODO we need to type check the result handler and see if it is correct. Throw a error if handler is of wrong format at runtime somehow

    // handle rest
    this.configs = deepMerge(this.configs, tournamentConfigs);
    this.log.info('Initialized Round Robin Tournament');
  }

  public async run(configs?: DeepPartial<Tournament.TournamentConfigs<Configs>>) {
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
    let matchSets: Array<Set<Array<Bot>>> = [];
    for (let i = 0; i < this.configs.typeConfigs.times; i++) {
      matchSets.push(new Set());
    };
    for (let i = 0; i < this.configs.typeConfigs.times; i++) {
      this.competitors.forEach((bot1) => {
        this.competitors.forEach((bot2) => {
          if (bot1.tournamentID.id != bot2.tournamentID.id)
            matchSets[i].add([bot1, bot2]);
        });
      });
    }
    for (let i = 0; i < this.configs.typeConfigs.times; i++) {
      let set: Set<Array<Bot>> = matchSets[i];
      set.forEach((bots) => {
        this.matchQueue.push(bots);
      })
    };
  }
}