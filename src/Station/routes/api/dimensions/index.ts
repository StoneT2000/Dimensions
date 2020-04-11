/**
 * API for Dimensions. Primarily returns all data there is to return
 */
import express, { Request, Response } from 'express';
import { Dimension } from '../../../../Dimension';
import matchAPI from './match';
import tournamentAPI from './tournament';
import * as error from '../../../error'
const router = express.Router();


// Returns all observed dimensions
router.get('/', (req:Request, res: Response) => {
  res.json({error: null, dimensions: req.app.get('dimensions')});
});

// middle ware for finding dimension by id
const findDimension = (req: Request, res, next: express.NextFunction) => {
  let id = req.params.id;
  if (!id) return next(new error.BadRequest('ID must be provided'));
  let dimension: Dimension = req.app.get('dimensions').filter((d: Dimension) => d.id == parseInt(id))[0];
  if (!dimension) {
    
    return next(new error.BadRequest('No Dimension found'));
  }
  req.data.dimension = dimension;
  next();
};

// use the middleware
router.use('/:id', findDimension);

// Get a dimension and all its details
router.get('/:id', (req, res) => {
  res.json({error: null, dimension: req.data.dimension});
});

router.use('/:id/match', matchAPI);

router.use('/:id/tournament', tournamentAPI);

export default router