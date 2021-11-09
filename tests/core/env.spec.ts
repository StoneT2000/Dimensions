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

describe('Testing Environments without agents', () => {
  /**
   * Test the environments created by makeEnv
   * 
   * Does not run any agent procs, directly feeds in the inputs to the environments
   */
  const dim = new Dimension();
  const rpsenv = path.join(__dirname, '../envs/rps/env.py');
  const pendulumenv = path.join(__dirname, '../envs/pendulum/env.py');

  describe('Test functions on Multi Agent Environment: Rock Paper Scissors', () => {
    it('should initialize environment', async () => {
      const env = await dim.makeEnv(rpsenv, {
        max_cycles: 3,
      });
      expect(env.metaData['name']).to.equal('rps_v2');
    });
    it('should register agents in environment and get player ids', async () => {
      const env = await dim.makeEnv(rpsenv, {
        max_cycles: 3,
      });
      expect(env.metaData['name']).to.equal('rps_v2');
      const agents = ['a', 'b'];
      await env.registerAgents(agents);
      expect(env.agentIDToPlayerID.get(agents[0])).to.equal('player_0');
      expect(env.agentIDToPlayerID.get(agents[1])).to.equal('player_1');
    });
    it('should reset and step through environment', async () => {
      const env = await dim.makeEnv(rpsenv, {
        max_cycles: 3,
      });
      let data = await env.reset();
      expect(data['player_0'].obs).to.equal(3);
      expect(data['player_1'].obs).to.equal(3);

      data = await env.step({
        player_0: 2,
        player_1: 0,
      });
      expect(data['player_0'].obs).to.equal(0);
      expect(data['player_1'].obs).to.equal(2);
      expect(data['player_0'].reward).to.equal(-1);
      expect(data['player_1'].reward).to.equal(1);
      expect(data['player_0'].done).to.equal(false);
      expect(data['player_1'].done).to.equal(false);
    });
    it('should step through environment until completion', async () => {
      const env = await dim.makeEnv(rpsenv, {
        max_cycles: 3,
      });
      let data = await env.reset();
      data = await env.step({
        player_0: 2,
        player_1: 0,
      });
      data = await env.step({
        player_0: 2,
        player_1: 0,
      });
      data = await env.step({
        player_0: 2,
        player_1: 0,
      });
      expect(data['player_0'].done).to.equal(true);
      expect(data['player_1'].done).to.equal(true);
    });
  });
  describe('Test functions on Single Agent Environment: Pendulum', () => {
    it('should initialize environment', async () => {
      const env = await dim.makeEnv(pendulumenv, {
        max_steps: 30,
      });
      expect(env.metaData['name']).to.equal('Pendulum-v0');
    });
    it('should reset to fixed state and step through environment', async () => {
      const env = await dim.makeEnv(pendulumenv, {
        max_steps: 30,
      });
      const state = [1, 1]; // reset to a fixed state
      let data = await env.reset(state);
      expect(data['obs'][0]).to.approximately(0.5403022766113281, 1e-15);
      expect(data['obs'][1]).to.approximately(0.8414709568023682, 1e-15);
      expect(data['obs'][2]).to.approximately(1, 1e-15);

      data = await env.step(0);
      expect(data.reward).to.equal(-1.1);
      expect(data.done).to.equal(false);
    });
  });
  after(() => {
    dim.cleanup();
  });
});
