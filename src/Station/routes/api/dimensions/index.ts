/**
 * API for Dimensions. Primarily returns all data there is to return
 */
import express, { Request, Response } from 'express';
import { Dimension } from '../../../../Dimension';
import matchAPI, { pickMatch } from './match';
import tournamentAPI, { pickTournament } from './tournament';
import * as error from '../../../error'
import { pick } from '../../../../utils';
import { Design } from '../../../../Design';

const router = express.Router();

/**
 * GEt
 * Gets all observed dimensions
 */
router.get('/', (req:Request, res: Response) => {
  res.json({error: null, dimensions: req.app.get('dimensions')});
});

/**
 * Get a dimension from id 
 */
const getDimension = (req: Request, res, next: express.NextFunction) => {
  let id = req.params.id;
  if (!id) return next(new error.BadRequest('ID must be provided'));
  let dimension: Dimension = req.app.get('dimensions').filter((d: Dimension) => d.id == parseInt(id))[0];
  if (!dimension) {
    
    return next(new error.BadRequest('No Dimension found'));
  }
  req.data.dimension = dimension;
  next();
};
const pickDesign = (d: Design) => {
  let picked = {...pick(d, 'log', 'name')};
  picked['designOptions'] = d.getDesignOptions();
  return picked;
}
const pickDimension = (d: Dimension) => {
  let picked = {...pick(d, 'configs', 'id', 'log', 'name', 'statistics')};
  let pickedDesign = pickDesign(d.design);
  picked.design = pickedDesign;
  let pickedTournaments = d.tournaments.map((t) => pickTournament(t));
  picked.tournaments = pickedTournaments;
  return picked;
}

router.use('/:id', getDimension);

/**
 * Get the dimension and relevant data
 */
router.get('/:id', (req, res) => {
  res.json({error: null, dimension: pickDimension(req.data.dimension)});
});

/**
 * Use the match API here
 */
router.use('/:id/match', matchAPI);

/**
 * Returns all matches in the dimension
 */
router.get('/:id/match', (req: Request, res: Response) => {
  let matchData = {};
  req.data.dimension.matches.forEach((match, key) => {
    matchData[key] = pickMatch(match);
  });
  res.json({error: null, matches: matchData});
});

/**
 * Deletes a match
 */
router.delete('/:id/match/:matchID', (req, res, next) => {
  return req.data.dimension.removeMatch(parseInt(req.params.matchID)).then(() => {
    res.json({error: null});
  }).catch((error) => {
    return next(new error.InternalServerError('Something went wrong'));
  });
  // TODO: There should be a better way to abstract this so we don't need to store something related to the match API
  // in the dimensions API.
  // I also don't want to store a removeMatch function in the match itself as that doesn't make sense.
});

/**
 * GET
 * Gets all tournaments in a dimension
 */
router.get('/:id/tournament', (req: Request, res: Response) => {
  let tourneyData = req.data.dimension.tournaments.map((t) => pickTournament(t));
  res.json({error: null, tournaments: tourneyData});
});

/**
 * Use the tournament API
 */
router.use('/:id/tournament', tournamentAPI);



export default router