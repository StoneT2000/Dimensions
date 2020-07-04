import * as Dimension from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import { Tournament } from '../../../src';
import { DeepPartial } from '../../../src/utils/DeepPartial';

export const createRoundRobinTourney = (d: Dimension.DimensionType, botList: Array<any>, tournamentConfigs: DeepPartial<Tournament.TournamentConfigsBase> = {}) => {
  let tourney = <Dimension.Tournament.RoundRobin>d.createTournament(botList, {
    type: Dimension.Tournament.Type.ROUND_ROBIN,
    rankSystem: Dimension.Tournament.RankSystem.WINS,
    resultHandler: RockPaperScissorsDesign.winsResultHandler,
    agentsPerMatch: [2],
    consoleDisplay: false,
    ...tournamentConfigs
  });
  return tourney;
}

export const createLadderTourney = (d: Dimension.DimensionType, botList: Array<any>, tournamentConfigs: DeepPartial<Tournament.TournamentConfigsBase> = {}) => {
  let tourney = <Dimension.Tournament.Ladder>d.createTournament(botList, {
    type: Dimension.Tournament.Type.LADDER,
    rankSystem: Dimension.Tournament.RankSystem.TRUESKILL,
    resultHandler: RockPaperScissorsDesign.trueskillResultHandler,
    agentsPerMatch: [2],
    consoleDisplay: false,
    ...tournamentConfigs
  });
  return tourney;
}

export const createLadderELOTourney = (d: Dimension.DimensionType, botList: Array<any>, tournamentConfigs: DeepPartial<Tournament.TournamentConfigsBase> = {}) => {
  let tourney = <Dimension.Tournament.Ladder>d.createTournament(botList, {
    type: Dimension.Tournament.Type.LADDER,
    rankSystem: Dimension.Tournament.RankSystem.ELO,
    resultHandler: RockPaperScissorsDesign.eloResultHandler,
    agentsPerMatch: [2],
    consoleDisplay: false,
    ...tournamentConfigs
  });
  return tourney;
}

export const createElimTourney = (d: Dimension.DimensionType, botList: Array<any>, tournamentConfigs: DeepPartial<Tournament.TournamentConfigsBase> = {}) => {
  let tourney = <Dimension.Tournament.Elimination>d.createTournament(botList, {
    type: Dimension.Tournament.Type.ELIMINATION,
    rankSystem: Dimension.Tournament.RankSystem.WINS,
    resultHandler: RockPaperScissorsDesign.winsResultHandler,
    agentsPerMatch: [2],
    ...tournamentConfigs
  });
  return tourney;
}