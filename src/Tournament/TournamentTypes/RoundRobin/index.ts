import { TournamentTypeConfig, TournamentTypeState, RANK_SYSTEM } from "..";

// Configs specific to round robin tournaments, e.g association football
export interface Configs extends TournamentTypeConfig {
  times: number,
  rankSystem: RANK_SYSTEM
}
export interface State extends TournamentTypeState {

}