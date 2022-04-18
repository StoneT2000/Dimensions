import * as Tournament from '../index';
/**
 * The abstract Scheduler class for scheduling episodes in an Tournament
 */
export abstract class Scheduler {
  abstract schedule(
    players: Array<Tournament.PlayerStat<any>>,
    count: number
  ): Array<Tournament.QueuedEpisode>;
}
