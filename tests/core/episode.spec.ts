import { Dimension } from '../../src';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import path from 'path';
import 'mocha';
import { LocalProcess } from '../../src/Process/local';
import {
  Episode,
  MultiAgentEpisodeResult,
  SingleAgentEpisodeResult,
} from '../../src/Episode';

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
      // env.p.log.level = 10;
      expect(env.metaData['name']).to.equal('rps_v2');
      const { episode, results } = await dim.runEpisode(env, [
        rpsAgents.py,
        rpsAgents.py,
      ]);

      episode.agents.forEach((agent) => {
        expect(
          (results as MultiAgentEpisodeResult).final.data[
            env.agentIDToPlayerID.get(agent.id)
          ].done
        ).to.equal(true);
      });
    });
    it('should run step by step', async () => {
      const env = await dim.makeEnv(rpsenv, {
        max_cycles: 3,
      });
      expect(env.metaData['name']).to.equal('rps_v2');
      const episode = await dim.createEpisode(env, [
        rpsAgents.py,
        rpsAgents.py,
      ]);
      expect(Episode.episodeMap.has(episode.id));
      await episode.initialize();
      let done = await episode.stepParallel();
      expect(done).to.equal(false);
      expect(episode.results.outputs[1].data['player_0'].info.score).to.equal(
        0
      );
      expect(episode.results.outputs[1].actions['player_0']).to.equal(0);

      await episode.stepParallel();
      done = await episode.stepParallel();
      expect(done).to.equal(true);
      expect(episode.results.outputs.length).to.equal(4); // 4 values, 1st for init, then 1 for each step
    });
  });
  describe('Run episodes on Single Agent Environment: Pendulum', () => {
    it('should run an episode', async () => {
      const env = await dim.makeEnv(pendulumenv, {
        max_steps: 30,
      });
      const { results } = await dim.runEpisode(env, [pendulumAgents.py], 0);
      expect((results as SingleAgentEpisodeResult).final.data.done).to.equal(
        true
      );
      expect(
        (results as SingleAgentEpisodeResult).final.data.reward
      ).to.approximately(-9.364599159415079, 1e-15);
    });
    it('should run multiple episodes with the same agent without resetting the agent', async () => {
      const env = await dim.makeEnv(pendulumenv, {
        max_steps: 30,
      });
      const agent = dim.addAgent({
        agent: pendulumAgents.py,
        processOptions: {
          time: {
            perStep: 2000,
            overage: 0,
          },
        },
      });
      const rs = [];
      for (let i = 0; i < 4; i++) {
        const r1 = await dim.runEpisode(env, [agent], 0);
        rs.push(r1);
        if (i > 1) {
          expect(rs[i].results.final).to.eql(rs[i - 1].results.final);
        }
        expect(
          (r1.results as SingleAgentEpisodeResult).final.data.done
        ).to.equal(true);
        expect(
          (r1.results as SingleAgentEpisodeResult).final.data.reward
        ).to.approximately(-9.364599159415079, 1e-15);
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
      env.p.log.level = 0;
      const agent = dim.addAgent({
        agent: path.join(__dirname, '../envs/pendulum/agents/invalid_agent.py'),
        processOptions: {
          time: {
            perStep: 1000,
            overage: 0,
          },
        },
      });
      const { results } = await dim.runEpisode(env, [agent], 0);
      expect((results as SingleAgentEpisodeResult).outputs.length).to.equal(2); // should have a start and end observation only.
      expect(
        (results as SingleAgentEpisodeResult).outputs[1].data.info['err']
      ).to.equal('player_0 sent malformed action');
    });
    it('should handle not receiving back agent id and hanging', async () => {
      // this should print an error for agent
      const env = await dim.makeEnv(pendulumenv, {
        max_steps: 30,
      });
      env.p.log.level = 0;
      const agent = dim.addAgent({
        agent: path.join(
          __dirname,
          '../envs/pendulum/agents/malformed_handshake.py'
        ),
        processOptions: {
          time: {
            perStep: 1000,
            overage: 0,
          },
        },
      });
      const { results } = await dim.runEpisode(env, [agent], 0);
      expect((results as SingleAgentEpisodeResult).outputs.length).to.equal(2); // should have a start and end observation only.
      expect(
        (results as SingleAgentEpisodeResult).outputs[1].data.info['err']
      ).to.equal('player_0 sent malformed action');
    });
    it('should handle receiving malformed actions (incorrect key, bad json, hanging) and not hang', async () => {
      // this should print an error within env
      const env = await dim.makeEnv(pendulumenv, {
        max_steps: 30,
      });
      env.p.log.level = 10;
      const timerconf = {
        perStep: 20000,
        overage: 0,
      };
      const agent_badaction = dim.addAgent({
        agent: path.join(
          __dirname,
          '../envs/pendulum/agents/malformed_action.py'
        ),
        processOptions: { time: timerconf },
      });
      const agent_badjson = dim.addAgent({
        agent: path.join(
          __dirname,
          '../envs/pendulum/agents/malformed_action_badjson.py'
        ),
        processOptions: { time: timerconf },
      });
      let { results } = await dim.runEpisode(env, [agent_badaction], 0);
      expect((results as SingleAgentEpisodeResult).outputs.length).to.equal(2); // should have a start and end observation only.
      expect(
        (results as SingleAgentEpisodeResult).outputs[1].data.info['err']
      ).to.equal('player_0 sent malformed action');

      await env.reset();

      results = (await dim.runEpisode(env, [agent_badjson], 0)).results;
      expect((results as SingleAgentEpisodeResult).outputs.length).to.equal(2); // should have a start and end observation only.
      expect(
        (results as SingleAgentEpisodeResult).outputs[1].data.info['err']
      ).to.equal('player_0 sent malformed action');

      timerconf.perStep = 20;
      timerconf.overage = 1000;
      const agent_action_hang = dim.addAgent({
        agent: path.join(
          __dirname,
          '../envs/pendulum/agents/malformed_action_hang.py'
        ),
        processOptions: { time: timerconf },
      });
      await env.reset();

      results = (await dim.runEpisode(env, [agent_action_hang], 0)).results;
      expect((results as SingleAgentEpisodeResult).outputs.length).to.equal(2); // should have a start and end observation only.
      expect(
        (results as SingleAgentEpisodeResult).outputs[1].data.info['err']
      ).to.equal('player_0 sent malformed action');

      // // this agent hangs after 3 steps instead of start
      const agent_action_hang2 = dim.addAgent({
        agent: path.join(
          __dirname,
          '../envs/pendulum/agents/malformed_action_hang2.py'
        ),
        processOptions: { time: timerconf },
      });
      await env.reset();
      results = (await dim.runEpisode(env, [agent_action_hang2], 0)).results;
      expect((results as SingleAgentEpisodeResult).outputs.length).to.equal(5);
      expect(
        (results as SingleAgentEpisodeResult).final.data.info['err']
      ).to.equal('player_0 sent malformed action');
    });
    it('should handle agents that do not exit themselves', async () => {
      // this should print an error within env
      const env = await dim.makeEnv(pendulumenv, {
        max_steps: 30,
      });
      const timerconf = {
        perStep: 1000,
        overage: 0,
      };
      const agent_close = dim.addAgent({
        agent: path.join(
          __dirname,
          '../envs/pendulum/agents/malformed_close.py'
        ),
        processOptions: { time: timerconf },
      });
      const { results } = await dim.runEpisode(env, [agent_close], 0);
      expect((results as SingleAgentEpisodeResult).outputs.length).to.equal(31); // should run normally
      expect((<LocalProcess>agent_close.p).p.stdin.writable).to.equal(false);
    });
  });
  after(async () => {
    await dim.cleanup();
  });
});
