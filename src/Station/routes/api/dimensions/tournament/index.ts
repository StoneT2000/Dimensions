/**
 * API for dimension's tournaments
 */
import express, { Request, Response, NextFunction } from 'express';
import * as error from '../../../../error';
import { Tournament } from '../../../../../Tournament';
import { IncomingForm } from 'formidable';
import extract from 'extract-zip';
import { existsSync } from 'fs';
import path from 'path';
import ncp from 'ncp';
import { spawn } from 'child_process';
import matchAPI, { pickMatch } from '../match';
import { pick } from '../../../../../utils';
import { NanoID } from '../../../../../Dimension';
import { handleBotUpload, UploadData } from '../../../../handleBotUpload';
import { TournamentPlayerDoesNotExistError } from '../../../../../DimensionError';

const BOT_DIR = path.join(__dirname, '../../../../local/bots');
const BOT_DIR_TEMP = path.join(__dirname, '../../../../local/botstemp');
const router = express.Router();

/**
 * Get tournament by tournamentID in request. Requires dimension to be stored.
 */
const getTournament = (req: Request, res: Response, next: NextFunction) => {
  let tournament = 
    req.data.dimension.tournaments.get(req.params.tournamentID);
  if (!tournament) {
    return next(new error.BadRequest(`No tournament found with name or id of '${req.params.tournamentID}' in dimension ${req.data.dimension.id} - '${req.data.dimension.name}'`));
  }
  req.data.tournament = tournament;
  next();
}

router.use('/:tournamentID', getTournament);

/**
 * Picks out relevant fields for a tournament
 */
export const pickTournament = (t: Tournament) => {
  return pick(t, 'competitors', 'configs', 'id', 'log', 'name', 'status');
}

/**
 * GET
 * Gets tournament details
 */
router.get('/:tournamentID', (req, res) => {
  const picked = pickTournament(req.data.tournament);
  res.json({error: null, tournament: picked});
});

// attach the match API
router.use('/:tournamentID/match', matchAPI);

/**
 * GET
 * Returns all matches in the dimension
 */
router.get('/:tournamentID/match', (req: Request, res: Response) => {
  let matchData = {};
  req.data.tournament.matches.forEach((match, key) => {
    matchData[key] = pickMatch(match);
  });
  res.json({error: null, matches: matchData});
});



/**
 * GET
 * Get the current match queue
 */
router.get('/:tournamentID/matchQueue', (req, res) => {
  res.json({error: null, matchQueue: req.data.tournament.matchQueue});
});

/**
 * POST
 * Run a tournament if it is initialized or resume it if it was stopped
 */
router.post('/:tournamentID/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.data.tournament.status === Tournament.Status.INITIALIZED) {
      await req.data.tournament.run();
      res.json({error: null, msg:'Running Tournament'})
    }
    else if (req.data.tournament.status === Tournament.Status.STOPPED) {
      await req.data.tournament.resume();
      res.json({error: null, msg:'Running Tournament'})
    }
    else if (req.data.tournament.status === Tournament.Status.RUNNING) {
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

/**
 * POST
 * Stops a tournament if it isn't stopped
 */
router.post('/:tournamentID/stop', async (req: Request, res: Response, next: NextFunction) => {
  if (req.data.tournament.status !== Tournament.Status.RUNNING) {
    return next(new error.BadRequest(`Can't stop a tournament that isn't running`));
  }
  // stop the tournament
  if (req.data.tournament.stop()) {
    res.json({error: null, msg:'Stopped Tournament'})
  }
  else {
    return next(new error.InternalServerError('Couldn\'t stop the Tournament'));
  }
});

/**
 * GET
 * Gets ranks for the tournament
 */
router.get('/:tournamentID/ranks', async (req: Request, res: Response, next: NextFunction) => { 
  try {
    res.json({error: null, ranks: req.data.tournament.getRankings()});
  }
  catch {
    return next(new error.InternalServerError('Couldn\'t retrieve rankings'));
  }
});

/**
 * DELETE
 * 
 * Deletes a match
 */
router.delete('/:tournamentID/match/:matchID', (req, res, next) => {
  return req.data.tournament.removeMatch(req.params.matchID).then(() => {
    res.json({error: null});
  }).catch((err) => {
    return next(new error.InternalServerError('Something went wrong'));
  });
  // TODO: There should be a better way to abstract this so we don't need to store something related to the match API
  // in the dimensions API.
  // I also don't want to store a removeMatch function in the match itself as that doesn't make sense.
});

/**
 * DELETE
 * 
 * Removes a player with specified playerID
 */
router.delete('/:tournamentID/player/:playerID', (req, res, next) => {
  return req.data.tournament.removePlayer(req.params.playerID).then(() => {
    res.json({error: null});
  }).catch((err) => {
    if (err instanceof TournamentPlayerDoesNotExistError) {
      return next(new error.BadRequest(`Player with ID ${req.params.playerID} does not exist`));
    }
    else {
      return next(new error.InternalServerError(`Something went wrong: ${err.message}`));
    }
  });
});

/**
 * POST Route
 * Takes in form data of names: string[], files: File[], playerIDs: string[]
 * file must be a zip
 * id is a tournament ID string specified only if you want to upload a new bot to replace an existing one
 */
router.post('/:tournamentID/upload/', async (req: Request, res: Response, next: NextFunction) => { 
  let data: Array<UploadData>;
  try {
   data = await handleBotUpload(req);
  } catch(err) {
    return next(err);
  }
  
  if (data.length > 1) return next(new error.BadRequest('Can only upload one tournament bot at a time'));
  let bot = data[0];
  let id = bot.playerID;
  // if no id given, we will generate an ID to use. Generated here using the below function to avoid duplicate ids
  if (!id) {
    id = req.data.tournament.generateNextTournamentIDString();
  }
  if (bot.name) {
    req.data.tournament.addplayer({file: bot.file, name: bot.name, botdir: bot.botdir}, id);
  }
  else {
    req.data.tournament.addplayer(bot.file, id);
  }
  res.json({error: null, message: 'Successfully uploaded bot'});
});





export default router;