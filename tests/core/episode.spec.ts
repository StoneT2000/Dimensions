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

describe('Testing Episodes with Agents', () => {
  /**
   * Effectively tests runEpisode and the running of actual agents from files and error handling
   */
  const dim = new Dimension();
  const rpsenv = path.join(__dirname, '../envs/rps/env.py');
  const pendulumenv = path.join(__dirname, '../envs/pendulum/env.py');
  const pendulumAgents = {
    py: path.join(pendulumenv, '../agents/agent.py'),
  };
  const rpsAgents = {
    py: path.join(rpsenv, '../agents/agent.py'),
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
        -9.364599159415079,
        1e-15
      );
    });
    it('should run multiple episodes with the same agent without resetting the agent', async () => {
      const env = await dim.makeEnv(pendulumenv, {
        max_steps: 30,
      });
      const agent = dim.addAgent({
        agent: pendulumAgents.py,
        time: {
          perStep: 2000,
          overage: 0
        }
      })
      const rs = []
      for (let i = 0; i < 4; i++) {
        const r1 = await dim.runEpisode(env, [agent], 0);
        rs.push(r1);
        if (i > 1) {
          expect(rs[i].results.final).to.eql(rs[i-1].results.final);
        }
        expect(r1.results.final.data.done).to.equal(true);
        expect(r1.results.final.data.reward).to.approximately(
          -9.364599159415079,
          1e-15
        );
      }
    });
  });
  describe('Handling errors from agents', () => {
    it('should handle agent not starting when passed as agent object', async () => {
      // should have two error logs. agent process exiting and agent timing out but the reason being it didn't initialize due to not 
      // fulfilling id handshake
      const env = await dim.makeEnv(pendulumenv, {
        max_steps: 30,
      });
      env.envProcess.log.level = 0;
      const agent = dim.addAgent({
        agent: path.join(__dirname, '../envs/pendulum/agents/invalid_agent.py'),
        time: {
          perStep: 1000,
          overage: 0
        }
      })
      const { results } = await dim.runEpisode(env, [agent], 0);
      expect(results.outputs.length).to.equal(2); // should have a start and end observation only.
      expect(results.outputs[1].info['err']).to.equal("player_0 sent malformed action");
    });
    it('should handle not receiving back agent id and hanging', async () => {
      // this should print an error for agent
      const env = await dim.makeEnv(pendulumenv, {
        max_steps: 30,
      });
      env.envProcess.log.level = 0;
      const agent = dim.addAgent({
        agent: path.join(__dirname, '../envs/pendulum/agents/malformed_handshake.py'),
        time: {
          perStep: 1000,
          overage: 0
        }
      })
      const { results } = await dim.runEpisode(env, [agent], 0);
      expect(results.outputs.length).to.equal(2); // should have a start and end observation only.
      expect(results.outputs[1].info['err']).to.equal("player_0 sent malformed action");
    });
    it('should handle receiving malformed actions (incorrect key, bad json, hanging) and not hang', async () => {
      // this should print an error within env
      let env = await dim.makeEnv(pendulumenv, {
        max_steps: 30,
      });
      env.envProcess.log.level = 0;
      const timerconf = {
        perStep: 20000,
        overage: 0
      };
      const agent_badaction = dim.addAgent({
        agent: path.join(__dirname, '../envs/pendulum/agents/malformed_action.py'),
        time: timerconf
      });
      const agent_badjson = dim.addAgent({
        agent: path.join(__dirname, '../envs/pendulum/agents/malformed_action_badjson.py'),
        time: timerconf
      });
      let { results } = await dim.runEpisode(env, [agent_badaction], 0);
      expect(results.outputs.length).to.equal(2); // should have a start and end observation only.
      expect(results.outputs[1].info['err']).to.equal("player_0 sent malformed action");

      // make a new env since old one exited due to bad action.
      env = await dim.makeEnv(pendulumenv, {
        max_steps: 30,
      });
      env.envProcess.log.level = 0;
      results = (await dim.runEpisode(env, [agent_badjson], 0)).results;
      expect(results.outputs.length).to.equal(2); // should have a start and end observation only.
      expect(results.outputs[1].info['err']).to.equal("player_0 sent malformed action");


      timerconf.perStep = 10;
      timerconf.overage = 1000;
      const agent_action_hang = dim.addAgent({
        agent: path.join(__dirname, '../envs/pendulum/agents/malformed_action_hang.py'),
        time: timerconf
      });
      env = await dim.makeEnv(pendulumenv, {
        max_steps: 30,
      });
      env.envProcess.log.level = 0;
      results = (await dim.runEpisode(env, [agent_action_hang], 0)).results;
      expect(results.outputs.length).to.equal(2); // should have a start and end observation only.
      expect(results.outputs[1].info['err']).to.equal("player_0 sent malformed action");

      // this agent hangs after 3 steps instead of start
      const agent_action_hang2 = dim.addAgent({
        agent: path.join(__dirname, '../envs/pendulum/agents/malformed_action_hang2.py'),
        time: timerconf
      });
      env = await dim.makeEnv(pendulumenv, {
        max_steps: 30,
      });
      env.envProcess.log.level = 0;
      results = (await dim.runEpisode(env, [agent_action_hang2], 0)).results;
      expect(results.outputs.length).to.equal(5);
      expect(results.final.data.info['err']).to.equal("player_0 sent malformed action");
    });
    it('should handle agents that do not exit themselves', async () => {
      // this should print an error within env
      const env = await dim.makeEnv(pendulumenv, {
        max_steps: 30,
      });
      const timerconf = {
        perStep: 1000,
        overage: 0
      };
      const agent_close = dim.addAgent({
        agent: path.join(__dirname, '../envs/pendulum/agents/malformed_close.py'),
        time: timerconf
      });
      const { results } = await dim.runEpisode(env, [agent_close], 0);
      expect(results.outputs.length).to.equal(31); // should run normally
      expect(agent_close.p.p.stdin.writable).to.equal(false);
    });
  });
  after(() => {
    dim.cleanup();
  });
});
