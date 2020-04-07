import { TournamentBase } from "../../";
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
export class RoundRobinTournament extends TournamentBase {
  configs: Tournament.TournamentConfigs<Configs, State> = {
    defaultMatchConfigs: {},
    type: Tournament.TOURNAMENT_TYPE.ROUND_ROBIN,
    typeConfigs: null,
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
  }

  public async start(configs?: DeepPartial<Tournament.TournamentConfigs<Configs, State>>) {
    this.configs = deepMerge(this.configs, configs);
  }

  /**
   * Queue up all matches necessary
   */
  private schedule() {
    let matchSets = [];
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
    this.matchQueue
  }
}