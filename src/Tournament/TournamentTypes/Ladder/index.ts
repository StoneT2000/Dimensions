import { Tournament } from "../../";
import { DeepPartial } from "../../../utils/DeepPartial";
import { Design } from "../../../Design";
import { deepMerge } from "../../../utils/DeepMerge";

// Configs specific to elimination tournaments, e.g. battlecode, fencing DEs
export interface LadderConfigs extends Tournament.TournamentTypeConfig {
  times: number
}
export interface State extends Tournament.TournamentTypeState {

}
export class LeaderboardTournament extends Tournament {
  configs: Tournament.TournamentConfigs<LadderConfigs> = {
    defaultMatchConfigs: {},
    type: Tournament.TOURNAMENT_TYPE.ELIMINATION,
    rankSystem: null,
    rankSystemConfigs: null,
    tournamentConfigs: null,
    resultHandler: null
  }
  state: State;
  constructor(
    design: Design,
    files: Array<string> | Array<{file: string, name:string}>, 
    tournamentConfigs: DeepPartial<Tournament.TournamentConfigs<LadderConfigs>> = {},
    id: number
  ) {
    super(design, files, id);
    this.configs = deepMerge(this.configs, tournamentConfigs);
  }
  public getConfigs(): Tournament.TournamentConfigs<LadderConfigs> {
    return this.configs;
  }
  public setConfigs(configs: DeepPartial<Tournament.TournamentConfigs<LadderConfigs>> = {}) {
    this.configs = deepMerge(this.configs, configs);
  }
  public async run(configs?: DeepPartial<Tournament.TournamentConfigs<LadderConfigs>>) {
    this.configs = deepMerge(this.configs, configs);
  }
}
