import { Dimension, Tournament } from '../../../src';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import path from 'path';
import 'mocha';
import { WinsSystem } from '../../../src/Tournament/RankSystem/Wins';
import { RandomScheduler } from '../../../src/Tournament/Scheduler/random';
import {
  TrueSkillSystem,
  TrueSkill,
} from '../../../src/Tournament/RankSystem/TrueSkillSystem';
import { sleep } from '../../../src/utils';

const expect = chai.expect;
chai.should();
chai.use(chaiAsPromised);
chai.use(chaiSubset);

describe.only('Testing Tournament Running', () => {
  /**
   * Test the environments created by makeEnv
   *
   * Does not run any agent procs, directly feeds in the inputs to the environments
   */
  const dim = new Dimension();
  const rpsenv = path.join(__dirname, '../../envs/rps/env.py');
  const pendulumenv = path.join(__dirname, '../../envs/pendulum/env.py');
  const rpsAgents = {
    py: path.join(rpsenv, '../agents/agent.py'),
    js: path.join(rpsenv, '../agents/paper.js'),
  };
  describe('Test Tournament Format on Rock Paper Scissors', () => {
    it('should initialize tournament', async () => {
      const ranksystem = new WinsSystem();
      const ts = new TrueSkillSystem({
        initialMu: 25,
        initialSigma: 25 / 3,
      });
      const randomSched = new RandomScheduler({ teamsPerMatch: [2] });
      const tournament = new Tournament<TrueSkillSystem>(
        rpsenv,
        dim,
        ts,
        randomSched,
        {
          concurrent: 1,
          name: 'testrps',
          teamsPerMatch: [2],
        }
      );
      // tournament.competitors.get("abc").rankState.rating
      await tournament.registerPlayer(rpsAgents.py);
      await tournament.registerPlayer(rpsAgents.js);
      tournament.run();
      await sleep(1000);
      // await tournament.pause();
      await tournament.close();
      await sleep(500);
    });
  });
  describe.skip('Test handling Environment raised errors in Tournament', () => {
    /**
     * We expect user provided environments to **never** error. Should it raise some error and hang, we must eventually close it.
     */
    it('should handle when environment is not valid python / cannot load', async () => {
      await expect(
        dim.makeEnv(
          path.join(__dirname, '../envs/error/env_load_error.py'),
          {},
          { name: 'ErrorEnv' }
        )
      ).to.be.rejectedWith(Error, /Process errored out/);
    });
  });
  after(async () => {
    await dim.cleanup();
  });
});
