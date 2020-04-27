/**
 * API for dimension's agents
 */
import express, { Request, Response, NextFunction } from 'express';
import * as error from '../../../../../error';
import { Match } from '../../../../../../Match';
import { Agent } from '../../../../../../Agent';
import { pick } from '../../../../../../utils';

import { getMatch } from '../';

const router = express.Router();

/**
 * Agent finding middleware. Requires a tournament or dimension to be stored
 */
export const getAgent = (req: Request, res: Response, next: NextFunction) => {
  let agent = 
    req.data.match.idToAgentsMap.get(parseInt(req.params.agentID));
  if (!agent) {
    return next(new error.BadRequest(`No match found with name or id of '${req.params.matchID}' in dimension ${req.data.dimension.id} - '${req.data.dimension.name}'`));
  }
  req.data.agent = agent;
  next();
}

/**
 * Picks out relevant fields of the agent
 * @param agent 
 */
export const pickAgent = (agent: Agent) => {
  let picked = pick(agent, 'agentTimeStep', 'cmd', 'creationDate', 'cwd', 'file', 'id', 'isTerminated', 'name', 'src', 'status', 'tournamentID');
  return picked;
};

router.use('/:agentID', getAgent);

/**
 * Get all agents in match
 */
router.get('/', (req: Request, res: Response) => {
  let agentData = req.data.match.agents.map((agent) => pickAgent(agent));
  res.json({error: null, agents: agentData})
});

/**
 * Get agent details
 */
router.get('/:agentID', (req, res) => {
  res.json({error: null, agent: pickAgent(req.data.agent)});
});

export default router;