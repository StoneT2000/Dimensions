import * as Dimension from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import { Tournament } from '../../../src';
import { DeepPartial } from '../../../src/utils/DeepPartial';

export const createRoundRobinTourney = (
  d: Dimension.DimensionType,
  botList: Array<any>,
  tournamentConfigs: DeepPartial<Tournament.TournamentConfigsBase> = {}
): Tournament.RoundRobin => {
  const tourney = <Dimension.Tournament.RoundRobin>d.createTournament(botList, {
    type: Dimension.Tournament.Type.ROUND_ROBIN,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    rankSystem: Tournament.RankSystemTypes.WINS,
    resultHandler: RockPaperScissorsDesign.winsResultHandler,
    agentsPerMatch: [2],
    consoleDisplay: false,
    ...tournamentConfigs,
  });
  return tourney;
};

export const createLadderTourney = (
  d: Dimension.DimensionType,
  botList: Array<any>,
  tournamentConfigs: DeepPartial<
    Tournament.TournamentConfigs<Tournament.Ladder.Configs>
  > = {}
): Tournament.Ladder => {
  const tourney = <Dimension.Tournament.Ladder>d.createTournament(botList, {
    type: Dimension.Tournament.Type.LADDER,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    rankSystem: Dimension.Tournament.RankSystemTypes.TRUESKILL,
    resultHandler: RockPaperScissorsDesign.trueskillResultHandler,
    agentsPerMatch: [2],
    consoleDisplay: false,
    ...tournamentConfigs,
  });
  return tourney;
};

export const createLadderELOTourney = (
  d: Dimension.DimensionType,
  botList: Array<any>,
  tournamentConfigs: DeepPartial<
    Tournament.TournamentConfigs<Tournament.Ladder.Configs>
  > = {}
): Tournament.Ladder => {
  const tourney = <Dimension.Tournament.Ladder>d.createTournament(botList, {
    type: Dimension.Tournament.Type.LADDER,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    rankSystem: Dimension.Tournament.RankSystemTypes.ELO,
    resultHandler: RockPaperScissorsDesign.eloResultHandler,
    agentsPerMatch: [2],
    consoleDisplay: false,
    ...tournamentConfigs,
  });
  return tourney;
};

export const createElimTourney = (
  d: Dimension.DimensionType,
  botList: Array<any>,
  tournamentConfigs: DeepPartial<Tournament.TournamentConfigsBase> = {}
): Tournament.Elimination => {
  const tourney = <Dimension.Tournament.Elimination>d.createTournament(
    botList,
    {
      type: Dimension.Tournament.Type.ELIMINATION,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      rankSystem: Dimension.Tournament.RankSystemTypes.WINS,
      resultHandler: RockPaperScissorsDesign.winsResultHandler,
      agentsPerMatch: [2],
      ...tournamentConfigs,
    }
  );
  return tourney;
};
