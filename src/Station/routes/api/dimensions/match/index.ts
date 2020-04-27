/**
 * API for dimension's matches
 */
import express, { Request, Response, NextFunction } from 'express';
import * as error from '../../../../error';
import { Match } from '../../../../../Match';
import { pick } from '../../../../../utils';
import agentRouter, { pickAgent } from './agent';
const router = express.Router();

/**
 * Get match by matchID. Requires a tournament or dimension to be stored
 */
export const getMatch = (req: Request, res: Response, next: NextFunction) => {
  let match: Match;
  if (req.data.tournament){
    match = req.data.tournament.matches.get(parseInt(req.params.matchID));
  }
  else if (req.data.dimension) {
    match = req.data.dimension.matches.get(parseInt(req.params.matchID));
  }
  else {
    return next(new error.BadRequest(`System error. match API route was added out of order`));
  }
  if (!match) {
    return next(new error.BadRequest(`No match found with name or id of '${req.params.matchID}' in dimension ${req.data.dimension.id} - '${req.data.dimension.name}'`));
  }
  req.data.match = match;
  next();
}

/**
 * Pick relevant fields of a match
 */
export const pickMatch = (match: Match) => {
  let picked = pick(match, 'agentFiles','configs', 'creationDate','id', 'idToAgentsMap','log', 'mapAgentIDtoTournamentID', 'matchStatus','name');
  picked.agents = match.agents.map((agent) => pickAgent(agent));
  return picked;
};

router.use('/:matchID', getMatch);

/**
 * Get match details
 */
router.get('/:matchID', (req, res) => {
  res.json({error: null, match: pickMatch(req.data.match)});
});

/**
 * Gets whatever is stored in the match results field
 */
router.get('/:matchID/results', (req, res) => {
  res.json({error: null, results: req.data.match.results || null});
});

/**
 * Gets whatever is stored in the match state
 */
router.get('/:matchID/state', (req, res) => {
  res.json({error: null, results: req.data.match.state || null});
});

/**
 * POST
 * Run/resume a match if it hasn't initialiized, or was finished, or is currently stopped
 */
router.post('/:matchID/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.data.match.matchStatus === Match.Status.FINISHED || 
      req.data.match.matchStatus === Match.Status.UNINITIALIZED) {
      await req.data.match.initialize();
    }
    else if (req.data.match.matchStatus === Match.Status.RUNNING) {
      return next(new error.BadRequest('Match is already riunning'));
    }
    // run or resume the match
    if (req.data.match.matchStatus === Match.Status.STOPPED) {
      req.data.match.resume();
    }
    else {
      req.data.match.run();
    }
    res.json({error: null, msg:'Running Match'})
  }
  catch(error) {
    return next(new error.InternalServerError('Match Failed to Run'));
  }
});

/**
 * POST
 * Stop a match
 */
router.post('/:matchID/stop', async (req: Request, res: Response, next: NextFunction) => {
  if (req.data.match.matchStatus === Match.Status.STOPPED) {
    return next(new error.BadRequest('Match is already stopped'));
  }
  if (req.data.match.matchStatus === Match.Status.FINISHED) {
    return next(new error.BadRequest('Match is already finished'));
  }
  if (req.data.match.matchStatus === Match.Status.UNINITIALIZED) {
    return next(new error.BadRequest('Can\'t stop an uninitialized match'));
  }
  
  if (req.data.match.stop()) {
    res.json({error: null, msg:'Stopped Match'})
  }
  else {
    return next(new error.InternalServerError('Couldn\'t stop the match'));
  }
});

router.use('/:matchID/agent', agentRouter);

export default router;