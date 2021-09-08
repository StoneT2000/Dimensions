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

describe('Testing Episodes', () => {
  const dim = new Dimension();
  const rpsenv = path.join(__dirname, '../envs/rps/env.py');
  const pendulumenv = path.join(__dirname, '../envs/pendulum/env.py');
  const pendulumAgents = {
    py: path.join(pendulumenv, '../agents/python.sh'),
  };
  const rpsAgents = {
    py: path.join(rpsenv, '../agents/python.sh'),
  };

  describe('Run episodes on Multi Agent Environment: Rock Paper Scissors', () => {
    it('should run an episode', async () => {
      const env = await dim.makeEnv(rpsenv, {
        max_cycles: 21,
      });
      expect(env.metaData['name']).to.equal('rps_v2');
      const { episode, results } = await dim.runEpisode(env, [
        rpsAgents.py,
        rpsAgents.py,
      ]);
      episode.agents.forEach((agent) => {
        expect(
          results.final.data[env.agentIDToPlayerID.get(agent.id)].done
        ).to.equal(true);
      });
    });
  });
  describe('Run episodes on Single Agent Environment: Pendulum', () => {
    it('should run an episode', async () => {
      const env = await dim.makeEnv(pendulumenv, {
        max_steps: 30,
      });
      const { results } = await dim.runEpisode(env, [pendulumAgents.py], 0);
      expect(results.final.data.done).to.equal(true);
      expect(results.final.data.reward).to.approximately(
        -9.778062662761881,
        1e-15
      );
    });
  });
  // describe('Test functions on Single Agent Environment: Pendulum', () => {

  // });
  after(() => {
    dim.cleanup();
  });
});
