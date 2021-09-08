import { Agent } from '../Agent';
import { DError } from '../DimensionError/wrapper';
import { Engine } from '../Engine';
import { Environment } from '../Environment';

export interface EpisodeResult {
  seed: number;
  state: Record<string, any>;
  outputs: Record<string, any>[];
  final: Record<string, any>;
}

/**
 * An Episode that handles the running of various types of episodes, from single agent environments to parallel actions multiagent environments
 *
 * Takes an environment and a list of initial agents to use to run a typical episode
 */
export class Episode {
  public engine: Engine = new Engine();
  constructor(public agents: Agent[], public env: Environment) {}
  async runSequential(
    seed: number = null,
    state: Record<string, any> = null
  ): Promise<EpisodeResult> {
    // await this.engine.initializeAgents(this.agents);
    seed;
    state;
    throw new DError.NotSupportedError('not supported yet');
    // return {};
  }
  /**
   *
   * For running Episodes where actions are taken simultaneously and agents receive observations at the same time.
   * @param seed - seed to use for the environment
   * @param state - state to initialize with
   * @returns
   */
  async runParallel(
    seed: number = null,
    state: Record<string, any> = null
  ): Promise<EpisodeResult> {
    await this.engine.initializeAgents(this.agents);

    // output of env at each step
    const outputs = [];

    if (seed !== null) {
      await this.env.seed(seed);
    }
    // create new initial state
    let data = await this.env.reset(state);
    outputs.push({
      actions: null,
      ...data,
    });

    let done = false;
    while (!done) {
      const actions = await this.engine.collectActions(
        this.env,
        data,
        this.agents
      );

      data = await this.env.step(actions);
      done = this.engine.envDone(this.env, data, this.agents);
      await this.engine.handleAgents(this.env, data, this.agents);
      outputs.push({
        actions,
        ...data,
      });
    }
    return {
      seed,
      state,
      outputs,
      final: {
        actions: null,
        data,
      },
    };
  }
}
