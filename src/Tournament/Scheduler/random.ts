import { Scheduler } from '.';
import { PlayerStat, QueuedEpisode } from '..';
import { chooseKRandomElements } from './utils';
export interface Configs {
  teamsPerMatch: number[];
}
export class RandomScheduler extends Scheduler {
  constructor(public configs: Configs) {
    super();
  }
  schedule(players: PlayerStat<any>[], count: number): QueuedEpisode[] {
    const q: QueuedEpisode[] = [];
    for (let i = 0; i < count; i++) {
      const teams = this.configs.teamsPerMatch[
        Math.floor(Math.random() * this.configs.teamsPerMatch.length)
      ];
      const chosen = chooseKRandomElements(players, teams);
      const eps: QueuedEpisode = chosen.map((c) => {
        return { playerID: c.player.id, agent: c.player.agent };
      });
      q.push(eps);
    }
    return q;
  }
}
