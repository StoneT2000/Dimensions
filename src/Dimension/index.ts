import * as DError from '../DimensionError';
import { deepMerge } from '../utils/DeepMerge';
import { DeepPartial } from '../utils/DeepPartial';
import { Configs } from './types';
import { Configs as AgentConfigs } from '../Agent/types';
import { Environment } from '../Environment';
import { Agent } from '../Agent';
import { Engine } from '../Engine';
import { Process } from '../Process';
import { Episode, EpisodeResult } from '../Episode';
import { EnvConfigs, EnvConfigs_DEFAULT } from '../Environment/types';
/**
 * A Dimension is a factory object that can create new environment instances, new agent instances, and link them together
 *
 * You can have multiple agents interact with one or multiple environment instances, a single agent interact with a single or multiple instances etc.
 */
export class Dimension {
  public configs: Configs = {
    station: false,
    name: 'default_dimension',
    defaultEnvConfigs: EnvConfigs_DEFAULT,
  };

  public agents: Map<string, Agent> = new Map();

  public id: string = null;

  private static globalID = 0;
  private engine: Engine = new Engine();

  constructor(configs: DeepPartial<Configs> = {}) {
    this.configs = deepMerge(this.configs, configs);
    this.id = `dimension_${Dimension.globalID++}`;

    // set up cleanup functions
    process.on('exit', async () => {
      try {
        await this.cleanup();
      } catch (err) {
        console.error(err);
      }
      process.exit();
    });

    process.on('SIGINT', async () => {
      try {
        await this.cleanup();
      } catch (err) {
        console.error(err);
      }
      process.exit();
    });
  }
  addAgent(configs: DeepPartial<AgentConfigs> = {}): Agent {
    const agent = new Agent(configs);
    this.agents.set(agent.id, agent);
    return agent;
  }
  async removeAgent(agentID: string): Promise<boolean> {
    if (this.agents.has(agentID)) {
      await this.agents.get(agentID).close();
    }
    return this.agents.delete(agentID);
  }
  /**
   * Creates a new environment, which runs the given environment on its own process
   *
   * Optionally provide a display name for logging purposes.
   */
  async makeEnv(
    environment: string,
    envConfigs: Record<string, any> = {},
    configs: DeepPartial<EnvConfigs> = {}
  ): Promise<Environment> {
    const env = new Environment(
      environment,
      envConfigs,
      deepMerge(configs, this.configs.defaultEnvConfigs)
    );
    await env.setup();
    return env;
  }

  async createEpisode(
    env: Environment,
    agents: (Agent | string)[]
  ): Promise<Episode> {
    const runAgents: Agent[] = [];
    agents.forEach((agent) => {
      if (agent instanceof Agent) {
        runAgents.push(agent);
      } else {
        const newAgent = this.addAgent({ agent });
        runAgents.push(newAgent);
      }
    });
    // register initial agents
    await env.registerAgents(runAgents.map((a) => a.id));
    const episode = new Episode(runAgents, env);
    return episode;
  }

  /**
   * Run an episode in the given environment and given agents in parallel mode
   *
   * @param env - The environment to use
   * @param agents - List of agents to use that can submit actions to the environment
   * @param seed - a seed to use for the environment RNG
   * @param state - a state to start from
   *
   * Agents can be specified by providing an initialized agent object if that agent process is to be reused elsewhere,
   * or by paths to the agent executable, of which an agent process will be initialized and then
   * closed at the end of the episode.
   */
  async runEpisode(
    env: Environment,
    agents: (Agent | string)[],
    seed: number = null,
    state: Record<string, any> = null,
    mode: 'parallel' | 'sequential' = 'parallel'
  ): Promise<{
    episode: Episode;
    results: EpisodeResult;
  }> {
    const tempAgentIDs: Set<string> = new Set();
    const runAgents: Agent[] = [];
    agents.forEach((agent) => {
      if (agent instanceof Agent) {
        runAgents.push(agent);
      } else {
        const newAgent = this.addAgent({ agent });
        tempAgentIDs.add(newAgent.id);
        runAgents.push(newAgent);
      }
    });
    // register initial agents
    await env.registerAgents(runAgents.map((a) => a.id));

    const episode = new Episode(runAgents, env);
    let results: EpisodeResult;
    if (mode === 'parallel') {
      await episode.initialize(seed, state);
      results = await episode.runParallel();
    } else if (mode === 'sequential') {
      results = await episode.runSequential(seed, state);
    } else {
      throw new DError.NotSupportedError(
        `${mode} is not supported or is invalid`
      );
    }
    await episode.close();

    tempAgentIDs.forEach((id) => {
      this.removeAgent(id);
    });
    return {
      episode,
      results,
    };
  }

  /**
   * Cleanup the Dimension to gracefully quit and avoid leaks
   */
  async cleanup(): Promise<void> {
    try {
      const closePromises: Promise<any>[] = [];
      closePromises.push(
        Promise.all(Array.from(this.agents.values()).map((a) => a.close())),
        Promise.all(
          Array.from(Environment.envmap.values()).map((e) => e.close())
        )
      );
      await Promise.all(closePromises);
      await Process._closeAllProcesses();
    } catch (err) {
      // skip any possible errors here.
      console.error(err);
      return;
    }
  }
}
