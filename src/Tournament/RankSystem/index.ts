import { ELORating } from '../ELO';
import { Rating } from 'ts-trueskill';
import { Agent } from '../../Agent';
import { Player } from '..';

/**
 * Abstract Rank system class, that takes in generic types for configurations and arank state
 */
export abstract class RankSystem<Configs, RankState> {
  abstract configs: Configs;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor() {}

  /**
   * Given a rank state, reset it and return the new rank state
   */
  abstract resetRank(rankState: RankState): RankState;

  /**
   * Given an array of rank states and parallel array of the rankings each of the players associated with the rank
   * states received, return a new array of updated rank states in the same order.
   */
  abstract updateRanks(
    rankStates: Array<RankState>,
    relativeRanks: Array<number>
  ): Array<RankState>;

  /**
   * Initialize rank state from scratch. Returns the rank state for new players to the tournament
   */
  abstract initializeRankState(): RankState;

  /**
   * Function that is called whenever a player is updated (new bot code). This returns a rank state that is stored
   * as the player's new rank state
   * @param rankState - the rank state of the player that just got updated
   */
  abstract onPlayerUpdate(rankState: RankState): RankState;

  /**
   * Compare two rank states and return 0 if they are of equivalent rank, return a negative number
   * if rankState1 < rankState2 and negative otherwise. Effectiely sort in descending rank with rank 1 being highest
   */
  abstract rankComparator(rankState1: RankState, rankState2: RankState): number;

  /**
   * For terminal live display of ladder tournament. This forms the header of the table
   */
  abstract getRankStatesHeaderString(): string;

  /**
   * For terminal live display of ladder tournaments. This forms the row of the table given a rank state
   */
  abstract getRankStateString(
    player: Player,
    rankState: RankState,
    matchesPlayed: number
  ): string;
}

import * as TS from './TrueSkillSystem';
import * as EL from './ELOSystem';

/**
 * Rank System enums and namespaces for the kind of ranking systems you can choose for a {@link Tournament}
 */

export namespace RankSystem {
  /* eslint-disable */
  export import TrueSkillSystem = TS.TrueSkillSystem;
  export import TrueSkill = TS.TrueSkill;
  export import ELOSystem = EL.ELOSystem;
  export import ELO = EL.ELO;
  /* eslint-enable */

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface ConfigsBase {}

  /** The results interface that must be returned by a result handler for a {@link Tournament} */
  export interface Results {
    /**
     * Array of {@link Agent.ID}s and their ranks in a {@link Match}. ranks can be the same number of players
     * are considered to have tied or achieved equal standing
     */
    ranks: Array<{ rank: number; agentID: Agent.ID }>;
  }

  /**
   * Wins rank system. Ranks based on Wins, Ties, and Losses.
   */
  export namespace WINS {
    /**
     * The configuration interface for configuring the {@link WINS} ranking system
     */
    export interface Configs extends ConfigsBase {
      /** Points given per win in a {@link Match} */
      winValue: number;
      /** Points given per tie in a {@link Match} */
      tieValue: number;
      /** Points given per loss in a {@link Match} */
      lossValue: number;
      /** True if first place is the one with the most points. */
      descending: boolean;
    }

    /** The results interface that must be returned by a result handler for a {@link Tournament} */
    export interface Results {
      /** Array of agent IDs of {@link agent}s that won in the {@link Match}*/
      winners: Array<Agent.ID>;
      /** Array of agent IDs of {@link agent}s that tied in the {@link Match}*/
      ties: Array<Agent.ID>;
      /** Array of agent IDs of {@link agent}s that lost in the {@link Match}*/
      losers: Array<Agent.ID>;
    }
  }
}
