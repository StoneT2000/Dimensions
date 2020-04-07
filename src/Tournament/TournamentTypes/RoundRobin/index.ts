import { TournamentTypeConfig, TournamentTypeState } from "..";

// Configs specific to round robin tournaments, e.g association football, halite
export interface Configs extends TournamentTypeConfig {
  times: number
}
export interface State extends TournamentTypeState {

}