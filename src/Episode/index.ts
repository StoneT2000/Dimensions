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
  public results: EpisodeResult = {
    seed: null,
    state: null,
    outputs: [],
    final: {
      actions: null,
      data: {},
    },
  };
  constructor(public agents: Agent[], public env: Environment) {}

  /**
   * Initialize and start a new episode with the given seed and state. When parameters set to null, env should use defaults
   *
   * This function also is what starts the processes for all agents
   * @param seed
   * @param state
   */
  async initialize(
    seed: number = null,
    state: Record<string, any> = null
  ): Promise<void> {
    await this.engine.initializeAgents(this.agents);
    if (seed !== null) {
      await this.env.seed(seed);
    }
    // create new initial state
    const data = await this.env.reset(state);
    this.results.outputs.push({
      actions: null,
      data,
    });
  }
  /**
   * Step forward the environment with the given agents once.
   */
  async stepParallel(): Promise<boolean> {
    let data = this.results.outputs[this.results.outputs.length - 1].data;
    const actions = await this.engine.collectActions(
      this.env,
      data,
      this.agents
    );
    data = await this.env.step(actions);
    const done = this.engine.envDone(this.env, data, this.agents);
    await this.engine.handleAgents(this.env, data, this.agents);
    this.results.outputs.push({
      actions,
      data,
    });
    return done;
  }

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
  async runParallel(): Promise<EpisodeResult> {
    let done = false;
    while (!done) {
      done = await this.stepParallel();
    }
    this.results.final = this.results.outputs[this.results.outputs.length - 1];
    return this.results;
  }
}
