/**
 * API for dimension's matches
 */
import express, { Request, Response, NextFunction } from 'express';
import { Match } from '../../../../../';
import * as error from '../../../../error';
const router = express.Router();

// find match by name or ID middleware
const findMatch = (req: Request, res: Response, next: NextFunction) => {
  let match = 
    req.data.dimension.matches.filter((match) => match.id == parseInt(req.params.matchID) || match.name == req.params.matchID)[0];
  if (!match) {
    res.json({error: `No match found with name / id of '${req.params.matchID}' in dimension ${req.data.dimension.id} - '${req.data.dimension.name}'`})
    return;
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

router.post('/:matchID/run', (req: Request, res: Response, next: NextFunction) => {
  
  try {
    req.data.match.run()
    res.json({error: null, msg:'Running Match'})
  }
  catch(error) {
    return next(new error.InternalServerError('Match Failed to run'));
  }
})

export default router;