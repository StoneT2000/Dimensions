import { TournamentTypeState, TournamentTypeConfig } from "..";

// Configs specific to elimination tournaments, e.g. battlecode, fencing DEs
export interface Configs extends TournamentTypeConfig {
  times: number
}
export interface State extends TournamentTypeState {

}