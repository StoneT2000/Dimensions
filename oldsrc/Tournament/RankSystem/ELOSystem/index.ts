import { sprintf } from 'sprintf-js';
import { DeepPartial } from '../../../utils/DeepPartial';
import { deepMerge } from '../../../utils/DeepMerge';
import { deepCopy } from '../../../utils/DeepCopy';
import { ELORating, ELOWrapper } from '../../ELO';
import { RankSystem } from '..';
import { Player } from '../..';

export class ELOSystem extends RankSystem<ELO.Configs, ELO.RankState> {
  public configs: ELO.Configs = {
    startingScore: 1000,
    kFactor: 32,
  };
  private elo: ELOWrapper;
  constructor(configs: DeepPartial<ELO.Configs>) {
    super();
    this.configs = deepMerge(this.configs, deepCopy(configs));
    this.elo = new ELOWrapper(this.configs.kFactor, this.configs.startingScore);
  }

  initializeRankState(): ELO.RankState {
    return {
      rating: this.elo.createRating(),
    };
  }

  onPlayerUpdate(rankState: ELO.RankState): ELO.RankState {
    return {
      rating: this.elo.createRating(rankState.rating.score),
    };
  }

  updateRanks(
    rankStates: Array<ELO.RankState>,
    relativeRanks: Array<number>
  ): Array<ELO.RankState> {
    const ratings: Array<ELORating> = [];
    rankStates.forEach((rankState) => {
      ratings.push(this.elo.createRating(rankState.rating.score));
    });
    this.elo.rate(ratings, relativeRanks);
    return ratings.map((value) => {
      return { rating: value };
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resetRank(rankState: ELO.RankState): ELO.RankState {
    return {
      rating: this.elo.createRating(),
    };
  }

  rankComparator(rankState1: ELO.RankState, rankState2: ELO.RankState): number {
    return rankState2.rating.score - rankState1.rating.score;
  }

  getRankStatesHeaderString(): string {
    return sprintf(
      `%-30s | %-15s | %-15s | %-8s`.underline,
      'Name',
      'ID',
      'ELO Score',
      'Matches'
    );
  }

  getRankStateString(
    player: Player,
    rankState: ELO.RankState,
    matchesPlayed: number
  ): string {
    return sprintf(
      `%-30s`.blue + ` | %-15s | ` + `%-15s`.green + ` | %-8s`,
      player.tournamentID.name,
      player.tournamentID.id,
      rankState.rating.score,
      matchesPlayed
    );
  }
}

export namespace ELO {
  /**
   * The configuration interface for configuring the {@link ELO} ranking system
   */
  export interface Configs {
    /**
     * Starting ELO score
     * @default `1000`
     */
    startingScore: number;
    /**
     * The k factor to use for the ranking.
     * @default `32`
     */
    kFactor: number;
  }

  /** The current rank state of a player */
  export interface RankState {
    /** The ELO Rating */
    rating: ELORating;
  }
}
