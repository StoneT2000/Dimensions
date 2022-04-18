import { Agent } from '../Agent';
import { DError } from '../DimensionError/wrapper';
import { Engine } from '../Engine';
import { Environment } from '../Environment';
import { genID, NanoID } from '../utils';
export interface EpisodePlayerObsRewardDoneInfo {
  obs: any;
  reward: number;
  done: boolean;
  info: Record<string, any> & { score: number };
  player_id?: string;
}
export interface SingleAgentEpisodePlayerFrame {
  actions: any;
  data: EpisodePlayerObsRewardDoneInfo;
}
export interface MultiAgentEpisodePlayerFrame {
  actions: Record<string, any>;
  data: Record<string, EpisodePlayerObsRewardDoneInfo>;
}
export interface EpisodeResult {
  seed: number;
  state: Record<string, any>;
}
export interface MultiAgentEpisodeResult extends EpisodeResult {
  outputs: MultiAgentEpisodePlayerFrame[];
  final: MultiAgentEpisodePlayerFrame;
}
export interface SingleAgentEpisodeResult extends EpisodeResult {
  /**
   * Each episode frame with each element keyed by player id
   */
  outputs: SingleAgentEpisodePlayerFrame[];
  final: SingleAgentEpisodePlayerFrame;
}

/**
 * An Episode that handles the running of various types of episodes, from single agent environments to parallel actions multiagent environments
 *
 * Takes an environment and a list of initial agents to use to run a typical episode
 */
export class Episode {
  public engine: Engine = new Engine();
  public results: SingleAgentEpisodeResult | MultiAgentEpisodeResult = {
    seed: null,
    state: null,
    outputs: [],
    final: null,
  };
  public id: NanoID;
  static episodeMap: Map<string, Episode> = new Map();
  constructor(public agents: Agent[], public env: Environment) {
    do {
      this.id = `eps_${genID(16)}`;
    } while (Episode.episodeMap.has(this.id));
    Episode.episodeMap.set(this.id, this);
  }

  /**
   * Clean up the episode
   */
  async close(): Promise<void> {
    Episode.episodeMap.delete(this.id);
  }

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
    const data = (await this.env.reset(state)) as any;
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
    data = (await this.env.step(actions)) as any;
    const done = this.engine.envDone(this.env, data, this.agents);
    await this.engine.handleAgents(this.env, data, this.agents);
    this.results.outputs.push({
      actions,
      data: data as any,
    });
    return done;
  }

  async runSequential(
    seed: number = null,
    state: Record<string, any> = null
  ): Promise<SingleAgentEpisodeResult | MultiAgentEpisodeResult> {
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
  async runParallel(): Promise<
    SingleAgentEpisodeResult | MultiAgentEpisodeResult
  > {
    let done = false;
    while (!done) {
      done = await this.stepParallel();
    }
    this.results.final = this.results.outputs[this.results.outputs.length - 1];
    return this.results;
  }
}
