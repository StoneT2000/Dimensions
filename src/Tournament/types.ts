import { RankSystem } from './RankSystem';

/**
 * Various Tournament Statuses
 */
export enum TournamentStatus {
  /** Status when tournament was just called with new */
  UNINITIALIZED = 'uninitialized',
  /** Tournament is ready to run*/
  INITIALIZED = 'initialized',
  /** Tournament is currently stopped */
  STOPPED = 'stopped',
  /** Tournament is running */
  RUNNING = 'running',
  /** Tournament crashed some how */
  CRASHED = 'crashed',
  /** Tournament is done */
  FINISHED = 'finished',
}

export interface TournamentConfigs {
  concurrent: number;
  name?: string;
  teamsPerMatch: number[];
  // rankSystem: RankSystem<any, any>;
}
