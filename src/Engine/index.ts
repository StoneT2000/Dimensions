import {Agent} from '../Agent';
import { AgentActions } from '../Environment/types';
/**
 * Class for functional handling of agents and environments and any other processes
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
      actionPromises.push((async () => {
        try {
          await agent.initialize();
          await agent.pause();
        } catch {
          // okay to fail to initialize
        }
      })());
    }
  }

  /**
   * Send shared and agent specific data to agents and collect their outputs (actions)
   * 
   * Auto attempts to resume agent process and pause it after action is done.
   * 
   * @param data 
   * @param agents 
   * @returns list of agent actions
   */
  async collectActions(data: Record<string, any>, agents: Agent[]): Promise<AgentActions> {
    const actionPromises: Promise<Record<string, any>>[] = [];
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      if (agent.active()) {
        actionPromises.push((async () => {
          await agent.resume();
          const res = await agent.action(data);
          await agent.pause();
          return res;
        })());
      } else {
        actionPromises.push(null);
      }
    }
    return Promise.all(actionPromises);
  }
}