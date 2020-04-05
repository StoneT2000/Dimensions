/**
 * API for dimension's matches
 */
import express, { Request, Response, NextFunction } from 'express';
import { Match } from '../../../../../';
import * as error from '../../../../error';
import { MatchStatus } from '../../../../../Match';
const router = express.Router();

// find match by name or ID middleware
const findMatch = (req: Request, res: Response, next: NextFunction) => {
  let match = 
    req.data.dimension.matches.filter((match) => match.id == parseInt(req.params.matchID) || match.name == req.params.matchID)[0];
  if (!match) {
    return next(new error.BadRequest(`No match found with name or id of '${req.params.matchID}' in dimension ${req.data.dimension.id} - '${req.data.dimension.name}'`));
  }
  req.data.match = match;
  next();
}
router.get('/', (req: Request, res: Response) => {
  res.json({error: null, matches: req.data.dimension.matches})
});
router.use('/:matchID', findMatch);
// Get match details
router.get('/:matchID', (req, res) => {
  res.json({error: null, match: req.data.match});
});

// Get match results
router.get('/:matchID/results', (req, res) => {
  res.json({error: null, results: req.data.match.results || null});
});
router.post('/:matchID/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: This route should also initialize a match if its not initialized yet or is finished (and so all agents are killed )
    if (req.data.match.matchStatus === MatchStatus.FINISHED || 
      req.data.match.matchStatus === MatchStatus.UNINITIALIZED) {
      await req.data.match.initialize();
    }
    else if (req.data.matchStatus === MatchStatus.RUNNING) {
      return next(new error.BadRequest('Match is already riunning'));
    }
    // run the match
    req.data.match.run()
    res.json({error: null, msg:'Running Match'})
  }
  catch(error) {
    return next(new error.InternalServerError('Match Failed to Run'));
  }
});

// Stops a match
router.post('/:matchID/stop', async (req: Request, res: Response, next: NextFunction) => {
  if (req.data.matchStatus === MatchStatus.STOPPED) {
    return next(new error.BadRequest('Match is already stopped'));
  }
  // stop the match
  if (req.data.match.stop()) {
    res.json({error: null, msg:'Stopped Match'})
  }
  else {
    return next(new error.InternalServerError('Couldn\'t stop the match'));
  }
});

// Resumes a match
router.post('/:matchID/resume', async (req: Request, res: Response, next: NextFunction) => {
  if (req.data.matchStatus === MatchStatus.RUNNING) {
    return next(new error.BadRequest('Match is already running'));
  }
  // resume the match
  if (req.data.match.resume()) {
    res.json({error: null, msg:'Resumed Match'})
  }
  else {
    return next(new error.InternalServerError('Couldn\'t resume the match'));
  }
});

export default router;