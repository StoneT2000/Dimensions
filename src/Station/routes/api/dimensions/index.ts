/**
 * API for Dimensions. Primarily returns all data there is to return
 */
import express, { Request, Response, NextFunction } from 'express';
import { Dimension } from '../../../../Dimension';
import matchAPI, { pickMatch } from './match';
import tournamentAPI, { pickTournament } from './tournament';
import * as error from '../../../error'
import { pick } from '../../../../utils';
import { Design } from '../../../../Design';
import userAPI from './user';
import authAPI from './auth';
import { handleBotUpload } from '../../../handleBotUpload';
import path from 'path';
import { spawn } from 'child_process';
import { removeDirectory } from '../../../../utils/System';

const router = express.Router();

/**
 * GEt
 * Gets all observed dimensions
 */
router.get('/', (req:Request, res: Response) => {
  let dimMap = req.app.get('dimensions');
  let data = {}
  dimMap.forEach((dimension: Dimension) => {
    data[dimension.id] = pickDimension(dimension);
  });
  res.json({error: null, dimensions: data});
});

/**
 * Get a dimension from id 
 */
const getDimension = (req: Request, res, next: express.NextFunction) => {
  let id = req.params.id;
  if (!id) return next(new error.BadRequest('ID must be provided'));
  let dimension: Dimension = req.app.get('dimensions').get(id);
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
  let pickedTournaments = {}
  d.tournaments.forEach((t) => {
    pickedTournaments[t.id] = pickTournament(t);
  });
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
 * POST
 * Creates a match using the provided zip files of bots.
 * Requires files: Array<zip files>, paths: JSON encoding of array of paths to the main file in the zip file, 
 * names?: Array<string>
 */
router.post('/:id/match', async (req: Request, res: Response, next: NextFunction) => {

  try {
    let data = await handleBotUpload(req);
    let dim = req.data.dimension;
    let match = await dim.createMatch(data);
    match.run().then(() => {
      // delete all bot files and their directories as they are temporary and generated
      data.forEach(({ file }) => {
        let dir = path.dirname(file);
        removeDirectory(dir);
      });
    }).catch(() => {
      // ignore errors
    });
    res.json({error: null, matchID: match.id});
  }
  catch(err) {
    return next(err);
  }
});

/**
 * Deletes a match
 */
router.delete('/:id/match/:matchID', async (req, res, next) => {
  try {
    await req.data.dimension.removeMatch(req.params.matchID);
    res.json({ error: null });
  }
  catch (error) {
    return next(new error.InternalServerError('Something went wrong'));
  }
  // TODO: There should be a better way to abstract this so we don't need to store something related to the match API
  // in the dimensions API.
  // I also don't want to store a removeMatch function in the match itself as that doesn't make sense.
});

/**
 * GET
 * Gets all tournaments in a dimension
 */
router.get('/:id/tournament', (req: Request, res: Response) => {
  let pickedTournaments = {}
  req.data.dimension.tournaments.forEach((t) => {
    pickedTournaments[t.id] = pickTournament(t);
  });
  res.json({error: null, tournaments: pickedTournaments});
});

/**
 * Use the tournament API
 */
router.use('/:id/tournament', tournamentAPI);

export const requiresDatabase = (req: Request, res: Response, next: NextFunction) => {
  // throw a error if no database detected
  let dimension = req.data.dimension;
  if(dimension.hasDatabase()) {
    next();
  }
  else {
    next(new error.InternalServerError(
      `No database setup for dimension - ID: ${dimension.id}, name: ${dimension.name}`
      ));
  }
}

/** Require that user and auth routes need database setup */
router.use('/:id/user', requiresDatabase);
router.use('/:id/auth', requiresDatabase);

/**
 * Use the user API
 */
router.use('/:id/user', userAPI);

/**
 * Use the auth API
 */
router.use('/:id/auth', authAPI);


export default router