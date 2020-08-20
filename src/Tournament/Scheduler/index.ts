import { Tournament, Player } from "..";
import seedrandom from 'seedrandom';
import { chooseKRandomElements } from "./utils";
/**
 * The Scheduler class with functions to help schedule tournament matches
 */
export class Scheduler {
  /**
   * Randomly picks enough players for a match and schedules a match with them. 
   * 
   * Returns the Scheduler function that can 
   * be passed to the {@link Tournament.Ladder.Configs.matchMake} field
   */
  static Random(configs: Scheduler.RandomConfigs = { agentsPerMatch: [2], scheduleEvenly: true }) : (players: Array<Tournament.Ladder.PlayerStat>) => Array<Tournament.QueuedMatch> {
    const rng = seedrandom(configs.seed);
    return (players: Array<Tournament.Ladder.PlayerStat>) => {
      const queue: Array<Tournament.QueuedMatch> = [];
      if (configs.scheduleEvenly) {
        for (let i = 0; i < players.length; i++) {
          const agentCount = configs.agentsPerMatch[Math.floor(rng() * configs.agentsPerMatch.length)];
          // note: filter is faster than doing [...players.slice(0, i), ...players.slice(i+1)]
          const chosen = 
            chooseKRandomElements(players.filter((_, j) => j != i), agentCount - 1)
              .map((p) => p.player.tournamentID.id);
          chosen.push(players[i].player.tournamentID.id);
          queue.push(chosen);
        }
      }
      else {
        const agentCount = configs.agentsPerMatch[Math.floor(rng() * configs.agentsPerMatch.length)];
        const chosen = chooseKRandomElements(players, agentCount).map((p) => p.player.tournamentID.id);
        queue.push(chosen);
      }
      return queue;
    }
  }

  /**
   * Randomly picks one player and randomly selects enough players within `configs.range` ranks of the first picked 
   * player. If there are not enough players within `configs.range` ranks due to a player having a rank close to 1 or 
   * the very bottom, it will be appropriately padded on the higher or lower ranking side. If there are still not enough
   * players to choose from, then algorithm selects from what is available.
   * 
   * This is also the default algorithm used by the {@link Tournament.Ladder | Ladder Tournament}
   * 
   * Returns the Scheduler function that can 
   * be passed to the {@link Tournament.Ladder.Configs.matchMake} field
   */
  static RankRangeRandom(configs: Scheduler.RankRangeRandomConfigs = { agentsPerMatch: [2], scheduleEvenly: true, range: 4 }) : (players: Array<Tournament.Ladder.PlayerStat>) => Array<Tournament.QueuedMatch> {
    const rng = seedrandom(configs.seed);
    
    return (players: Array<Tournament.Ladder.PlayerStat>) => {
      const queue: Array<Tournament.QueuedMatch> = [];
      const generateMatch = (i: number) => {
        const agentCount = configs.agentsPerMatch[Math.floor(rng() * configs.agentsPerMatch.length)];
        let left = i - configs.range;
        let right = i + configs.range + 1;
        if (left < 0) {
          // pad right
          right += 0 - left;
        }
        else if (right > players.length) {
          // pad left
          left -= Math.max(0, right - players.length);
        }
        const chosen = 
          chooseKRandomElements(
            [...players.slice(left, i), ...players.slice(i + 1, right)],
            agentCount - 1
          ).map((p) => p.player.tournamentID.id);
        chosen.push(players[i].player.tournamentID.id);
        queue.push(chosen);
      }
      if (configs.scheduleEvenly) {
        for (let i = 0; i < players.length; i++) {
          generateMatch(i);
        }
      }
      else {
        generateMatch(Math.floor(Math.random() * players.length));
      }
      return queue;
    }
  }
}

export module Scheduler {
  export interface ConfigsBase { 
    /** 
     * array of possible number of agents/players that can be put in single match, e.g. [2, 4] means 2 or 4 agents can 
     * compete together 
     * 
     * @default `[2]`
     */
    agentsPerMatch: Array<number>

    /** 
     * If true, scheduler will ensure every player will compete in the same number of matches as other players by 
     * iterating each player and queueing a match with that player in it
     * 
     * Otherwise the scheduler will randomly queue one appropriate match for a random player
     * 
     * @default `true`
     */
    scheduleEvenly: boolean
  }
  export interface RandomConfigs extends ConfigsBase {
    /** an optional seed to seed the random number generator */
    seed?: any;
  }
  export interface RankRangeRandomConfigs extends ConfigsBase {
    /** the range of rankings a player can be competing with */
    range: number;
    /** an optional seed to seed the random number generator */
    seed?: any;
  }
}