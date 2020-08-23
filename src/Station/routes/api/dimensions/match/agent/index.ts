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
 * Gets agent by agentID in request. Requires a match to be stored
 */
export const getAgent = (req: Request, res: Response, next: NextFunction) => {
  let agent: Agent;
  agent = req.data.match.agents[parseInt(req.params.agentID)];
  if (!agent) {
    return next(
      new error.BadRequest(
        `No agent found with id of '${req.params.agentID}' in match '${req.data.match.id}' in dimension ${req.data.dimension.id} - '${req.data.dimension.name}'`
      )
    );
  }
  req.data.agent = agent;
  next();
};

/**
 * Picks out relevant fields of the agent
 */
export const pickAgent = (agent: Agent) => {
  const picked = pick(
    agent,
    'creationDate',
    'id',
    'name',
    'src',
    'status',
    'tournamentID',
    'logkey'
  );
  return picked;
};

router.use('/:agentID', getAgent);

/**
 * Get all agents in match
 */
router.get('/', (req: Request, res: Response) => {
  const agentData = req.data.match.agents.map((agent) => pickAgent(agent));
  res.json({ error: null, agents: agentData });
});

/**
 * Get agent details
 */
router.get('/:agentID', (req, res) => {
  res.json({ error: null, agent: pickAgent(req.data.agent) });
});

/**
 * Get agent error logs
 */
router.get('/:agentID/logs', async (req, res, next) => {
  const agent = req.data.agent;
  if (agent.logkey) {
    if (req.data.dimension.hasStorage()) {
      const url = await req.data.dimension.storagePlugin.getDownloadURL(
        agent.logkey
      );
      res.json({ error: null, url: url });
    } else {
      res.sendFile(agent.logkey);
    }
  } else {
    return next(new error.BadRequest(`No agent logs found`));
  }
});

export default router;
