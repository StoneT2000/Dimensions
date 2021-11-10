import { Dimension } from '../../src';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import path from 'path';
import 'mocha';

const expect = chai.expect;
chai.should();
chai.use(chaiAsPromised);
chai.use(chaiSubset);

describe('Testing Agents', () => {
  /**
   * Test the environments created by makeEnv
   *
   * Does not run any agent procs, directly feeds in the inputs to the environments
   */
  const dim = new Dimension();
  // const rpsenv = path.join(__dirname, '../envs/rps/env.py');
  const pendulumenv = path.join(__dirname, '../envs/pendulum/env.py');

  describe('Test language agnoticism', () => {
    it('should run js', async () => {
      const env = await dim.makeEnv(pendulumenv, {
        max_steps: 30,
      });
      env.envProcess.log.level = 0;
      const agent = dim.addAgent({
        agent: path.join(__dirname, '../envs/pendulum/agents/agent.js'),
        time: {
          perStep: 1000,
          overage: 0,
        },
      });
      const r1 = await dim.runEpisode(env, [agent], 0);
      expect(r1.results.final.data.done).to.equal(true);
      expect(r1.results.final.data.reward).to.approximately(
        -9.364599159415079,
        1e-15
      );
    });
  });
  after(() => {
    dim.cleanup();
  });
});
