import { Tournament } from "../../";
import { DeepPartial } from "../../../utils/DeepPartial";
import { Design } from "../../../Design";
import { deepMerge } from "../../../utils/DeepMerge";

// Configs specific to elimination tournaments, e.g. battlecode, fencing DEs
export interface Configs extends Tournament.TournamentTypeConfig {
  times: number
}
export interface State extends Tournament.TournamentTypeState {

}
export class LeaderboardTournament extends Tournament {
  configs: Tournament.TournamentConfigs<Configs> = {
    defaultMatchConfigs: {},
    type: Tournament.TOURNAMENT_TYPE.ELIMINATION,
    rankSystem: null,
    rankSystemConfigs: null,
    typeConfigs: null,
    resultHandler: null
  }
  state: State;
  constructor(
    design: Design,
    files: Array<string> | Array<{file: string, name:string}>, 
    tournamentConfigs: DeepPartial<Tournament.TournamentConfigs<Configs>> = {},
    id: number
  ) {
    super(design, files, id);
    this.configs = deepMerge(this.configs, tournamentConfigs);
  }
  public async run(configs?: DeepPartial<Tournament.TournamentConfigs<Configs>>) {
    this.configs = deepMerge(this.configs, configs);
  }
}
