import { Dimension } from '../../../src/Dimension';
import { Design, Tournament } from '../../../src';

export const createCustomDesign = () => {
  let c = Design.createCustom('custom game', {
    command: './tests/customdesign/run.sh',
    arguments: [
      'D_FILES',
      'D_AGENT_IDS',
      'D_MATCH_ID',
      'D_MATCH_NAME',
      'D_NAMEs',
    ],
    resultHandler: (res) => {
      let ranks: Tournament.RankSystem.TRUESKILL.Results = {
        ranks: [
          { agentID: 0, rank: 1 },
          { agentID: 1, rank: 2 },
        ],
      };
      return ranks;
    },
  });
  return c;
};
