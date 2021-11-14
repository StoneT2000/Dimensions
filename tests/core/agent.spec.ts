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
  const rpsenv = path.join(__dirname, '../envs/rps/env.py');
  const pendulumenv = path.join(__dirname, '../envs/pendulum/env.py');

  describe('Test language agnoticism', () => {
    it('should run js', async () => {
      const env = await dim.makeEnv(pendulumenv, {
        max_steps: 30,
      });
      // env.p.log.level = 0;
      const agent = dim.addAgent({
        agent: path.join(__dirname, '../envs/pendulum/agents/agent.js'),
      });
      const r1 = await dim.runEpisode(env, [agent], 0);
      expect(r1.results.final.data.done).to.equal(true);
      expect(r1.results.final.data.reward).to.approximately(
        -9.364599159415079,
        1e-15
      );
    });
    it('should run python vs js', async () => {
      const env = await dim.makeEnv(rpsenv, {
        max_cycles: 30,
      });
      const agentjs = dim.addAgent({
        agent: path.join(__dirname, '../envs/rps/agents/paper.js'),
        location: 'docker',
      });
      const agentpy = dim.addAgent({
        agent: path.join(__dirname, '../envs/rps/agents/agent.py'),
        location: 'docker',
      });
      const r1 = await dim.runEpisode(env, [agentjs, agentpy], 0);
      
      for (const playerID in r1.results.final.data) {
        expect(r1.results.final.data[playerID].done).to.equal(true);
      }
      // paper beats rock 30/30 times.
      expect(r1.results.final.data['player_0'].info.score).to.equal(30);
    });
  });
  describe('Test docker agents', () => {
    it('should run python vs js in docker', async () => {
      const env = await dim.makeEnv(rpsenv, {
        max_cycles: 30,
      });
      const agentjs = dim.addAgent({
        agent: path.join(__dirname, '../envs/rps/agents/paper.js'),
        location: 'docker',
      });
      const agentpy = dim.addAgent({
        agent: path.join(__dirname, '../envs/rps/agents/agent.py'),
        location: 'docker',
      });
      const r1 = await dim.runEpisode(env, [agentjs, agentpy], 0);
      for (const playerID in r1.results.final.data) {
        expect(r1.results.final.data[playerID].done).to.equal(true);
      }
      // paper beats rock 30/30 times.
      expect(r1.results.final.data['player_0'].info.score).to.equal(30);
    });
    it('should run js in docker', async () => {
      const env = await dim.makeEnv(pendulumenv, {
        max_steps: 30,
      });
      const agent = dim.addAgent({
        agent: path.join(__dirname, '../envs/pendulum/agents/agent.js'),
        processOptions: {
          time: {
            perStep: 1000,
            overage: 0,
          },
        },
        location: 'docker',
      });
      const r1 = await dim.runEpisode(env, [agent], 0);
      expect(r1.results.final.data.done).to.equal(true);
      expect(r1.results.final.data.reward).to.approximately(
        -9.364599159415079,
        1e-15
      );
    });
    describe('Test error handling', () => {
      it('should handle invalid docker images', async () => {
        const agent = dim.addAgent({
          agent: path.join(__dirname, '../envs/rps/agents/paper.js'),
          location: 'docker',
          processOptions: {
            image: 'notrealimage',
          },
        });
        await expect(agent.initialize()).to.be.rejectedWith(
          Error,
          /No such image: notrealimage:latest/
        );
      });
      // TODO: There is an error on the circleci where this doesn't raise an error
      it.skip('should handle invalid docker socketpath', async () => {
        const agent = dim.addAgent({
          agent: path.join(__dirname, '../envs/rps/agents/paper.js'),
          location: 'docker',
          processOptions: {
            socketPath: 'notrealsocket',
          },
        });
        await expect(agent.initialize()).to.be.rejectedWith(
          Error,
          /connect ENOENT notrealsocket/
        );
      });
    });
  });
  after(async () => {
    await dim.cleanup();
  });
});
