import { sprintf } from 'sprintf-js';
import { Rating, rate } from 'ts-trueskill';
import { DeepPartial } from '../../../utils/DeepPartial';
import { deepMerge } from '../../../utils/DeepMerge';
import { deepCopy } from '../../../utils/DeepCopy';
import { RankSystem } from '..';
import { Player } from '../..';

export class TrueSkillSystem extends RankSystem<
  TrueSkill.Configs,
  TrueSkill.RankState
> {
  public configs: TrueSkill.Configs = {
    initialMu: 25,
    initialSigma: 25 / 3,
  };
  constructor(configs: DeepPartial<TrueSkill.Configs>) {
    super();
    this.configs = deepMerge(this.configs, deepCopy(configs));
  }
  initializeRankState(): TrueSkill.RankState {
    return {
      rating: {
        mu: this.configs.initialMu,
        sigma: this.configs.initialSigma,
        score: this.getScore(this.configs.initialMu, this.configs.initialSigma),
      },
    };
  }

  private getScore(mu: number, sigma: number) {
    return mu - 3 * sigma;
  }

  onPlayerUpdate(rankState: TrueSkill.RankState): TrueSkill.RankState {
    return {
      rating: {
        mu: rankState.rating.mu,
        sigma: this.configs.initialSigma,
        score: this.getScore(rankState.rating.mu, this.configs.initialSigma),
      },
    };
  }

  updateRanks(
    rankStates: Array<TrueSkill.RankState>,
    relativeRanks: Array<number>
  ): Array<TrueSkill.RankState> {
    const ratings: Array<Array<Rating>> = [];
    rankStates.forEach((rankState) => {
      ratings.push([new Rating(rankState.rating.mu, rankState.rating.sigma)]);
    });
    const newRatings = rate(ratings, relativeRanks);
    const newRankStates: Array<TrueSkill.RankState> = [];
    newRatings.forEach((rating) => {
      newRankStates.push({
        rating: {
          mu: rating[0].mu,
          sigma: rating[0].sigma,
          score: this.getScore(rating[0].mu, rating[0].sigma),
        },
      });
    });

    return newRankStates;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resetRank(rankState: TrueSkill.RankState): TrueSkill.RankState {
    return {
      rating: {
        mu: this.configs.initialMu,
        sigma: this.configs.initialSigma,
        score: this.getScore(this.configs.initialMu, this.configs.initialSigma),
      },
    };
  }

  rankComparator(
    rankState1: TrueSkill.RankState,
    rankState2: TrueSkill.RankState
  ): number {
    return rankState2.rating.score - rankState1.rating.score;
  }

  getRankStatesHeaderString(): string {
    return sprintf(
      `%-30s | %-14s | %-15s | %-18s | %-8s`.underline,
      'Name',
      'ID',
      'Score=(μ - 3σ)',
      'Mu: μ, Sigma: σ',
      'Matches'
    );
  }

  getRankStateString(
    player: Player,
    rankState: TrueSkill.RankState,
    matchesPlayed: number
  ): string {
    return sprintf(
      `%-30s`.blue +
        ` | %-14s | ` +
        `%-15s`.green +
        ` | ` +
        `μ=%-6s, σ=%-6s`.yellow +
        ` | %-8s`,
      player.name + (player.active ? '' : ' X'),
      player.id,
      (rankState.rating.mu - rankState.rating.sigma * 3).toFixed(7),
      rankState.rating.mu.toFixed(3),
      rankState.rating.sigma.toFixed(3),
      matchesPlayed
    );
  }
}

export namespace TrueSkill {
  export interface Configs {
    /**
     * The initial Mu value players start with
     * @default `25`
     */
    initialMu: number;
    /**
     * The initial sigma value players start with
     * @default `25/3`
     */
    initialSigma: number;
  }

  export interface RankState {
    /**
     * The trueskill rating
     */
    rating: {
      mu: number;
      sigma: number;
      score: number;
    };
  }
}
