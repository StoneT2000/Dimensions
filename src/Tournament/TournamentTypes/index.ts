import { MatchConfigs } from "../../Match";
import { DeepPartial } from "../../utils/DeepPartial";

export enum TOURNAMENT_TYPE {
  ROUND_ROBIN, // can be n-tuple round robin. E.g double roundrobin like most Association Football Leagues
  ELIMINATION, // standard elimination tournament. can be single, double, triple, n-tuple knockout
}
export enum TournamentStatus {
  UNINITIALIZED = 'uninitialized',
  STOPPED = 'stopped',
  RUNNING = 'running',
  CRASHED = 'crashed',
}
export interface TournamentConfigsBase {
  defaultMatchConfigs: DeepPartial<MatchConfigs>
  type: TOURNAMENT_TYPE,
}
export interface TournamentConfigs<ConfigType, StateType> extends TournamentConfigsBase {
  typeConfigs: ConfigType
  // the handler for returning the appropriate numbers given the results returned by getResults
  // is explicitly tied to the rank system chosen if necessary
  resultHandler: Function 
}
export interface TournamentTypeConfig  {

}
export interface TournamentTypeState  {
  
}

export enum RANK_SYSTEM {
  WINS = 'wins', // ranking by most wins
  ELO = 'elo', // ranking by elo

}