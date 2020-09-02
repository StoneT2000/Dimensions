import { sprintf } from 'sprintf-js';
import { DeepPartial } from '../../../utils/DeepPartial';
import { deepMerge } from '../../../utils/DeepMerge';
import { deepCopy } from '../../../utils/DeepCopy';
import { RankSystem } from '..';
import { Player } from '../..';
import { FatalError } from '../../../DimensionError';

export class WinsSystem extends RankSystem<Wins.Configs, Wins.RankState> {
  public configs: Wins.Configs = {
    winValue: 3,
    tieValue: 1,
    lossValue: 0,
    descending: true,
  };
  constructor(configs: DeepPartial<Wins.Configs>) {
    super();
    this.configs = deepMerge(this.configs, deepCopy(configs));
  }

  getPoints(wins: number, ties: number, losses: number): number {
    return (
      wins * this.configs.winValue +
      ties * this.configs.tieValue +
      losses * this.configs.lossValue
    );
  }

  initializeRankState(): Wins.RankState {
    return {
      wins: 0,
      losses: 0,
      ties: 0,
      points: this.getPoints(0, 0, 0),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onPlayerUpdate(rankState: Wins.RankState): Wins.RankState {
    return {
      wins: 0,
      losses: 0,
      ties: 0,
      points: this.getPoints(0, 0, 0),
    };
  }

  updateRanks(
    rankStates: Array<Wins.RankState>,
    relativeRanks: Array<number>
  ): Array<Wins.RankState> {
    if (relativeRanks.length > 2 || rankStates.length > 2) {
      throw new FatalError('WinsSystem only supports 2 agent matches');
    }
    if (relativeRanks[0] === relativeRanks[1]) {
      return rankStates.map((state) => {
        return {
          wins: state.wins,
          ties: state.ties + 1,
          losses: state.losses,
          points: this.getPoints(state.wins, state.ties + 1, state.losses),
        };
      });
    } else {
      let winningInd = 0;
      let losingInd = 1;
      if (relativeRanks[0] > relativeRanks[1]) {
        // if [1] won
        winningInd = 1;
        losingInd = 0;
      }
      return [
        {
          wins: rankStates[winningInd].wins + 1,
          ties: rankStates[winningInd].ties,
          losses: rankStates[winningInd].losses,
          points: this.getPoints(
            rankStates[winningInd].wins + 1,
            rankStates[winningInd].ties,
            rankStates[winningInd].losses
          ),
        },
        {
          wins: rankStates[losingInd].wins,
          ties: rankStates[losingInd].ties,
          losses: rankStates[losingInd].losses + 1,
          points: this.getPoints(
            rankStates[losingInd].wins,
            rankStates[losingInd].ties,
            rankStates[losingInd].losses + 1
          ),
        },
      ];
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resetRank(rankState: Wins.RankState): Wins.RankState {
    return {
      wins: 0,
      ties: 0,
      losses: 0,
      points: this.getPoints(0, 0, 0),
    };
  }

  rankComparator(
    rankState1: Wins.RankState,
    rankState2: Wins.RankState
  ): number {
    return this.configs.descending
      ? rankState2.points - rankState1.points
      : rankState1.points - rankState2.points;
  }

  getRankStatesHeaderString(): string {
    return sprintf(
      `%-30s | %-8s | %-4s | %-4s | %-4s | %-15s | %-8s`.underline,
      'Name',
      'ID',
      'W',
      'T',
      'L',
      'Points',
      'Matches'
    );
  }

  getRankStateString(
    player: Player,
    rankState: Wins.RankState,
    matchesPlayed: number
  ): string {
    return sprintf(
      `%-30s`.blue + ` | %-8s | ` + `%-15s`.green + ` | %-8s`,
      player.tournamentID.name,
      player.tournamentID.id,
      rankState.wins,
      rankState.ties,
      rankState.losses,
      rankState.points,
      matchesPlayed
    );
  }
}

export namespace Wins {
  /**
   * The configuration interface for configuring the {@link WINS} ranking system
   */
  export interface Configs {
    /** Points given per win in a {@link Match} */
    winValue: number;
    /** Points given per tie in a {@link Match} */
    tieValue: number;
    /** Points given per loss in a {@link Match} */
    lossValue: number;
    /** True if first place is the one with the most points. */
    descending: boolean;
  }

  /** The current rank state of a player */
  export interface RankState {
    wins: number;
    ties: number;
    losses: number;
    points: number;
  }
}
