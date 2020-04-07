import { Tournament, Bot } from "../../";
import { DeepPartial } from "../../../utils/DeepPartial";
import { Design } from "../../../Design";
import { deepMerge } from "../../../utils/DeepMerge";

// Configs specific to round robin tournaments, e.g association football
export interface Configs extends Tournament.TournamentTypeConfig {
  times: number,
  rankSystem: Tournament.RANK_SYSTEM
}
export interface State extends Tournament.TournamentTypeState {

}
/**
 * Round robin tournament
 * General expectations is it is always two agents only.
 */
export class RoundRobinTournament extends Tournament {
  configs: Tournament.TournamentConfigs<Configs, State> = {
    defaultMatchConfigs: {},
    type: Tournament.TOURNAMENT_TYPE.ROUND_ROBIN,
    typeConfigs: {
      times: 1,
      rankSystem: Tournament.RANK_SYSTEM.WINS
    },
    resultHandler: () => {}
  }
  state: State;
  constructor(
    design: Design,
    files: Array<string> | Array<{file: string, name:string}>, 
    tournamentConfigs: DeepPartial<Tournament.TournamentConfigs<Configs, State>> = {},
    id: number
  ) {
    super(design, files, id);
    this.configs = deepMerge(this.configs, tournamentConfigs);
    this.log.info('Initialized Round Robin Tournament');
  }

  public async run(configs?: DeepPartial<Tournament.TournamentConfigs<Configs, State>>) {
    return new Promise(async (resolve) => {
      this.configs = deepMerge(this.configs, configs);
      this.schedule();
      // console.log(this.matchQueue);
      while (this.matchQueue.length) {
        let matchInfo = this.matchQueue.shift();
        this.log.info('Running match', matchInfo);
        let res = await this.runMatch(matchInfo);
        this.log.info(res);
      }
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