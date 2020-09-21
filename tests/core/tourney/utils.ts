import { DimensionType } from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import { Tournament } from '../../../src';
import { DeepPartial } from '../../../src/utils/DeepPartial';

export const createLadderTourney = (
  d: DimensionType,
  botList: Array<any>,
  tournamentConfigs: DeepPartial<
    Tournament.TournamentConfigs<Tournament.Ladder.Configs>
  > = {}
): Tournament.Ladder => {
  const tourney = <Tournament.Ladder>d.createTournament(botList, {
    type: Tournament.Type.LADDER,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    rankSystem: Tournament.RankSystemTypes.TRUESKILL,
    resultHandler: RockPaperScissorsDesign.resultHandler,
    agentsPerMatch: [2],
    consoleDisplay: false,
    ...tournamentConfigs,
  });
  return tourney;
};

export const createLadderELOTourney = (
  d: DimensionType,
  botList: Array<any>,
  tournamentConfigs: DeepPartial<
    Tournament.TournamentConfigs<Tournament.Ladder.Configs>
  > = {}
): Tournament.Ladder => {
  const tourney = <Tournament.Ladder>d.createTournament(botList, {
    type: Tournament.Type.LADDER,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    rankSystem: Tournament.RankSystemTypes.ELO,
    resultHandler: RockPaperScissorsDesign.resultHandler,
    agentsPerMatch: [2],
    consoleDisplay: false,
    ...tournamentConfigs,
  });
  return tourney;
};

export const createElimTourney = (
  d: DimensionType,
  botList: Array<any>,
  tournamentConfigs: DeepPartial<Tournament.TournamentConfigsBase> = {}
): Tournament.Elimination => {
  const tourney = <Tournament.Elimination>d.createTournament(botList, {
    type: Tournament.Type.ELIMINATION,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    rankSystem: Tournament.RankSystemTypes.WINS,
    resultHandler: RockPaperScissorsDesign.resultHandler,
    agentsPerMatch: [2],
    ...tournamentConfigs,
  });
  return tourney;
};
