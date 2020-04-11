/**
 * API for dimension's tournaments
 */
import express, { Request, Response, NextFunction } from 'express';
import * as error from '../../../../error';
import { Tournament } from '../../../../../Tournament';
const router = express.Router();

// find tournament by name or ID middleware
const findTournament = (req: Request, res: Response, next: NextFunction) => {
  let tournament = 
    req.data.dimension.tournaments.filter((tournament) => tournament.id == parseInt(req.params.tournamentID) || tournament.name == req.params.tournamentID)[0];
  if (!tournament) {
    return next(new error.BadRequest(`No tournament found with name or id of '${req.params.tournamentID}' in dimension ${req.data.dimension.id} - '${req.data.dimension.name}'`));
  }
  req.data.tournament = tournament;
  next();
}
router.get('/', (req: Request, res: Response) => {
  res.json({error: null, tournaments: req.data.dimension.tournaments})
});
router.use('/:tournamentID', findTournament);

// Get tournament details
router.get('/:tournamentID', (req, res) => {
  const picked = (({status, state, competitors, name, configs}) => ({status, state, competitors, name, configs}))(req.data.tournament);
  res.json({error: null, tournament: picked});
});

// Get tournament's ongoing matches
router.get('/:tournamentID/matches', (req, res) => {
  res.json({error: null, matches: Array.from(req.data.tournament.matches)});
});

// Get tournament's current matchqueue
router.get('/:tournamentID/matchQueue', (req, res) => {
  const picked = (({matchQueue}) => ({matchQueue}))(req.data.tournament);
  res.json({error: null, matchQueue: picked});
});

router.post('/:tournament/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.data.tournament.status === Tournament.TournamentStatus.INITIALIZED) {
      await req.data.tournament.run();
      res.json({error: null, msg:'Running Tournament'})
    }
    else if (req.data.tournament.status === Tournament.TournamentStatus.STOPPED) {
      await req.data.tournament.resume();
      res.json({error: null, msg:'Running Tournament'})
    }
    else if (req.data.tournament.status === Tournament.TournamentStatus.RUNNING) {
      return next(new error.BadRequest('Tournament is already running'));
    }
    else {
      return next(new error.BadRequest(`Tournament cannot be run. Status is ${req.data.tournament.status}`));
    }
  }
  catch(error) {
    return next(new error.InternalServerError('Tournament Failed to Run'));
  }
});

// Stops a tournament
router.post('/:tournamentID/stop', async (req: Request, res: Response, next: NextFunction) => {
  if (req.data.tournament.status === Tournament.TournamentStatus.STOPPED) {
    return next(new error.BadRequest('Tournament is already stopped'));
  }
  // stop the tournament
  if (req.data.tournament.stop()) {
    res.json({error: null, msg:'Stopped Tournament'})
  }
  else {
    return next(new error.InternalServerError('Couldn\'t stop the Tournament'));
  }
});

router.get('/:tournamentID/ranks', async (req: Request, res: Response, next: NextFunction) => { 
  try {
    res.json({error: null, ranks: req.data.tournament.getRankings()});
  }
  catch {
    return next(new error.InternalServerError('Couldn\'t retrieve rankings'));
  }
})




export default router;