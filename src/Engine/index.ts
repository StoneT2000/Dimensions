import { Agent } from '../Agent';
import { Environment } from '../Environment';
import { AgentActions } from '../Environment/types';
import { deepCopy } from '../utils/DeepCopy';

/**
 * Class for functional management of agents and environments and any other processes
 */
export class Engine {
  // constructor() {

  // }
  /**
   * Initialize a list of agents
   * @param agents - the agents to initialize
   */
  async initializeAgents(agents: Agent[]): Promise<void> {
    const actionPromises: Promise<void>[] = [];
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      actionPromises.push(
        (async () => {
          try {
            await agent.initialize();
            await agent.pause();
          } catch {
            // okay to fail to initialize
          }
        })()
      );
    }
    await Promise.all(actionPromises);
  }

  /**
   * Using the environment, map agent ID to player IDs and store the actions associated with it
   *
   * This is then sent to the environment process so it receives actions ID'd by player ID.
   *
   * @param env
   * @param actions - a list of Record<string, any> | null that is the output from each agent. Null means the agent could not produce an output
   * @param agents
   * @returns
   */
  private formatActions = (
    env: Environment,
    actions: any,
    agents: Agent[]
  ): AgentActions => {
    const singleAgent = agents.length === 1;
    if (singleAgent) {
      return actions[0].action;
    } else {
      const formatted = {};
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        const playerID = env.agentIDToPlayerID.get(agent.id);
        formatted[playerID] = actions[i].action;
      }
      return formatted;
    }
  };

  /**
   * Send shared and agent specific data to agents and collect their outputs (actions)
   *
   * Auto attempts to resume agent process and pause it after action is done.
   *
   * @param data
   * @param agents
   * @returns list of agent actions
   */
  async collectActions(
    env: Environment,
    data: Record<string, any>,
    agents: Agent[]
  ): Promise<AgentActions> {
    const actionPromises: Promise<Record<string, any>>[] = [];
    const agentSpecificData = {};
    data = deepCopy(data);
    agents.forEach((agent, agentIndex) => {
      const agentSpecificObsKey = `player_${agentIndex}`;
      agentSpecificData[agentSpecificObsKey] = data[agentSpecificObsKey];
      delete data[agentSpecificObsKey];
    });
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const agentSpecificObsKey = `player_${i}`;
      if (agent.active()) {
        actionPromises.push(
          (async () => {
            // resume agent, send inputs and get actions, then pause agent again.
            await agent.resume();
            const agentInputs = {
              ...data,
              ...agentSpecificData[agentSpecificObsKey],
            };
            const act = await agent.action(agentInputs);
            // the action here may be well formated or null
            await agent.pause();
            return act;
          })()
        );
      } else {
        // if agent is not active, push a null
        actionPromises.push(
          (async () => {
            return { action: null };
          })()
        );
      }
    }

    const raw = await Promise.all(actionPromises);
    const actions = this.formatActions(env, raw, agents);
    return actions;
  }

  envDone(
    env: Environment,
    data: Record<string, any>,
    agents: Agent[]
  ): boolean {
    if (agents.length === 1) return data.done; // single agent case
    for (const k in data) {
      if (!data[k].done) {
        return false;
      }
    }
    return true;
  }

  /** Handles agents. Closes any agents that are done and sends them the final state. Data should be return value of env.step */
  async handleAgents(
    env: Environment,
    data: Record<string, any>,
    agents: Agent[]
  ): Promise<void> {
    const singleAgent = agents.length === 1;
    if (singleAgent) {
      if (data.done) {
        // TODO send agent final state
        await agents[0].close();
      }
    } else {
      await Promise.all(
        agents.map((agent) => {
          const playerID = env.agentIDToPlayerID.get(agent.id);
          if (data[playerID].done) {
            // TODO send agent final state
            // agent is done, close it
            return agent.close();
          }
          return Promise.resolve();
        })
      );
    }
  }
}
