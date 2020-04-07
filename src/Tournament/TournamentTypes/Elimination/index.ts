import { TournamentBase } from "../../";
import { DeepPartial } from "../../../utils/DeepPartial";
import { Design } from "../../../Design";
import { deepMerge } from "../../../utils/DeepMerge";

// Configs specific to elimination tournaments, e.g. battlecode, fencing DEs
export interface Configs extends Tournament.TournamentTypeConfig {
  times: number
}
export interface State extends Tournament.TournamentTypeState {

}
export class EliminationTournament extends TournamentBase {
  configs: Tournament.TournamentConfigs<Configs, State> = {
    defaultMatchConfigs: {},
    type: Tournament.TOURNAMENT_TYPE.ELIMINATION,
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
}
