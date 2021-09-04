import * as DError from "../DimensionError";
import { deepMerge } from "../utils/DeepMerge";
import { DeepPartial } from "../utils/DeepPartial";
import { Configs } from "./types";
import { Configs as AgentConfigs } from "../Agent/types";
import { Environment } from "../Environment";
import { Agent } from "../Agent";
import { Engine } from "../Engine";
/**
 * A Dimension is a factory object that can create new environment instances, new agent instances, and link them together
 * 
 * You can have multiple agents interact with one or multiple environment instances, a single agent interact with a single or multiple instances etc.
 */
export class Dimension {
  public configs: Configs = {
    station: false,
    name: 'default_dimension',
    environment: null,
  }
  
  public agents: Map<string, Agent> = new Map();

  public id: string = null;

  private static globalID = 0;
  private engine: Engine = new Engine();

  constructor(configs: DeepPartial<Configs> = {}) {
    this.configs = deepMerge(this.configs, configs);
    // if (!this.configs.environment) {
    //   throw new TypeError("No environment specification or executable provided")
    // }
    // if (!fs.existsSync(this.configs.environment)) {
    //   throw new DError.MissingFilesError(`no such file ${this.configs.environment}`);
    // }

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
   */
  async makeEnv(environment: string, envConfigs?: Record<string, any>): Promise<Environment> {
    const env = new Environment(environment, envConfigs);
    await env.setup();
    return env;
  }

  /**
   * Run an episode in the given environment and given agents
   * 
   * @param env - The environment to use
   * @param agents - List of agents to use that can submit actions to the environment
   * 
   * Agents can be specified by providing an initialized agent object if that agent process is to be reused elsewhere,
   * or by paths to the agent executable, of which an agent process will be initialized and then 
   * closed at the end of the episode.
   */
  async runEpisode(env: Environment, agents: (Agent | string)[], seed: number = null, state: Record<string, any> = null): Promise<Record<string, any>> {
    const tempAgentIDs: Set<string> = new Set();
    const runAgents = [];
    agents.forEach((agent) => {
      if (agent instanceof Agent) {
        runAgents.push(agent);
      } else {
        const newAgent = this.addAgent({agent});
        tempAgentIDs.add(newAgent.id);
        runAgents.push(newAgent);
      }
    });
    await this.engine.initializeAgents(runAgents);

    // output of env at each step
    const outputs = [];

    if (seed !== null) {
      await env.seed(seed);
    }
    // create new initial state
    let data = await env.reset(state);
    outputs.push({
      actions: [],
      data
    });

    let done = false;
    const stime = performance.now();
    while (!done) {
      const actions = await this.engine.collectActions(data, runAgents);
      data = await env.step(actions);
      done = data['done'];
      outputs.push({
        actions,
        data,
      });
    }
    // provide agents the final state that they can choose to use however they like. agents get their overage and their per time limit
    // left to do any finishing up actions.
    await this.engine.collectActions(data, runAgents);
    tempAgentIDs.forEach((id) => {
      this.removeAgent(id);
    });

    const elapsed = performance.now() - stime;
    console.log({
      elapsed,
      msPerStep: elapsed / env.steps
    });

    return {
      seed,
      state,
      outputs,
      final: {
        actions: [],
        data,
      }
    };
  }

  /**
   * Cleanup the Dimension to gracefully quit and avoid leaks
   */
  async cleanup(): Promise<void> {
    const closePromises: Promise<void>[] = [];
    this.agents.forEach((agent) => {
      closePromises.push(agent.close());
    });
    await Promise.all(closePromises);
  }
}