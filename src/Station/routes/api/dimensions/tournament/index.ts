/**
 * API for dimension's tournaments
 */
import express, { Request, Response, NextFunction } from 'express';
import * as error from '../../../../error';
import { Tournament, Player } from '../../../../../Tournament';
import path from 'path';
import matchAPI, { pickMatch } from '../match';
import { pick } from '../../../../../utils';

import { requireAuth, requireAdmin } from '../auth';

import { handleBotUpload, UploadData } from '../../../../handleBotUpload';
import { TournamentPlayerDoesNotExistError } from '../../../../../DimensionError';
import { removeDirectorySync } from '../../../../../utils/System';
import { spawnSync } from 'child_process';
import { Ladder } from '../../../../../Tournament/Ladder';
import { TournamentType } from '../../../../../Tournament/TournamentTypes';

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
 * 
 * Get the current match queue
 */
router.get('/:tournamentID/matchQueue', (req, res) => {
  res.json({error: null, matchQueue: req.data.tournament.matchQueue});
});


/**
 * POST
 * 
 * Set configs by specifying in a configs field of the body. This does a deep merge that overwrites only the fields
 * specified. Note that functions in the fields are always constant, and can never change.
 */
router.post('/:tournamentID/configs', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  if (!req.body.configs) return next(new error.BadRequest('Missing configs'));
  try {
    // ladder types have asynchronous config setting when using DB
    if (req.data.tournament.configs.type === TournamentType.LADDER) {
      let tournament = <Tournament.Ladder>req.data.tournament;
      await tournament.setConfigs(req.body.configs);
      res.json({error: null});
    }
    else {
      req.data.tournament.setConfigs(req.body.configs);
    }
  
  }
  catch(err) {
    return next(err);
  }
});

/**
 * POST
 * 
 * Run a tournament if it is initialized or resume it if it was stopped
 */
router.post('/:tournamentID/run', requireAdmin, (req: Request, res: Response, next: NextFunction) => {
  if (req.data.tournament.status === Tournament.Status.INITIALIZED) {
    req.data.tournament.run({}, true).then(() => {
      res.json({error: null, msg:'Running Tournament'});
    }).catch(next);
  }
  else if (req.data.tournament.status === Tournament.Status.STOPPED) {
    req.data.tournament.resume(true).then(() => {
      res.json({error: null, msg:'Running Tournament'});
    }).catch(next);
  }
  else if (req.data.tournament.status === Tournament.Status.RUNNING) {
    return next(new error.BadRequest('Tournament is already running'));
  }
  else {
    return next(new error.BadRequest(`Tournament cannot be run. Status is ${req.data.tournament.status}`));
  }
});

/**
 * POST
 * Stops a tournament if it isn't stopped
 */
router.post('/:tournamentID/stop', requireAdmin, (req: Request, res: Response, next: NextFunction) => {
  if (req.data.tournament.status !== Tournament.Status.RUNNING) {
    return next(new error.BadRequest(`Can't stop a tournament that isn't running`));
  }
  // stop the tournament
  req.data.tournament.stop(true).then(() => {
    res.json({error: null, msg:'Stopped Tournament'})
  }).catch(next);
});

/**
 * GET
 * Gets ranks for the tournament
 */
router.get('/:tournamentID/ranks', async (req: Request, res: Response, next: NextFunction) => { 
  try {
    let ranks = [];
    let offset = req.query.offset ? req.query.offset : 0;
    let limit = req.query.limit ? req.query.limit : -1;
    if (req.data.tournament.configs.type === TournamentType.LADDER) {
      ranks = await req.data.tournament.getRankings(offset, limit);
    }
    else {
      ranks = await req.data.tournament.getRankings();
    }

    res.json({error: null, ranks: ranks });
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
router.delete('/:tournamentID/match/:matchID', requireAdmin, (req, res, next) => {
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
router.delete('/:tournamentID/player/:playerID', requireAuth, (req, res, next) => {
  if (!req.data.dimension.databasePlugin.isAdmin(req.data.user) && req.params.playerID !== req.data.user.playerID) {
    return next(new error.Unauthorized(`Insufficient permissions to delete this player`));
  }
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
 * GET
 * 
 * Retrieves player data of the ongoing tournament
 */
router.get('/:tournamentID/player/:playerID', async (req, res, next) => {
  let tournament = req.data.tournament;
  res.json({error: null, player: tournament.competitors.get(req.params.playerID)});
});

/**
 * GET
 * 
 * Retrieves past player matches. Requires a backing database
 */
router.get('/:tournamentID/player/:playerID/match', async (req, res, next) => {
  if (!req.query.offset || !req.query.limit || !req.query.order) return next(new error.BadRequest('Missing params'));
  let tournament = req.data.tournament;
  let db = req.data.dimension.databasePlugin;
  if (req.data.dimension.hasDatabase()) {
    try {
      let matchData = await db.getPlayerMatches(req.params.playerID, req.params.tournamentID, parseInt(req.query.offset), parseInt(req.query.limit), parseInt(req.query.order));
      res.json({error: null, matches: matchData});
    } catch(err) {
      return next(err);
    }
  }
  else {
    // TODO: configure tournament.state.results to store more match meta data
    return next(new error.NotImplemented('Requires a database plugin in order to retrieve past matches'));
  }
});

/**
 * GET
 * 
 * Returns a url to download the bot if a storage service is provided, otherwise directly returns the bot file
 */
router.get('/:tournamentID/player/:playerID/bot', requireAuth, async (req, res, next) => {
  if (!req.data.dimension.databasePlugin.isAdmin(req.data.user) && req.params.playerID !== req.data.user.playerID) {
    return next(new error.Unauthorized(`Insufficient permissions to retrieve this player`));
  }
  let tournament = req.data.tournament;
  
  req.data.dimension.databasePlugin.getUser(req.params.playerID).then((user) => {
    let player: Player = user.statistics[tournament.getKeyName()].player;

    if (req.data.dimension.hasStorage()) {
      let key = player.botkey;
      req.data.dimension.storagePlugin.getDownloadURL(key).then((url) => {
        res.json({error: null, url: url});
      });
    }
    else {
      // send a zipped up version of their bot directly if no storage service is used 
      res.sendFile(player.zipFile);
    }
  }).catch(next);
  
});

router.post('/:tournamentID/reset', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  if (req.data.tournament.configs.type !== TournamentType.LADDER) {
    return (next(new error.BadRequest(`Can't reset a tournament that is not of the ladder type`)));
  }
  let tournament = <Tournament.Ladder>req.data.tournament;
  tournament.resetRankings().then(() => {
    res.json({error: null, message: 'ranks reset'});
  }).catch(next)
});

/**
 * POST Route
 * Takes in form data of names: string[], files: File[], playerIDs: string[]
 * file must be a zip
 * id is a tournament ID string specified only if you want to upload a new bot to replace an existing one
 * 
 * TODO: This route can be kind of slow because it reuploads a users bot and also checks its integrity and then deletes
 * it again
 */
router.post('/:tournamentID/upload/', requireAuth, async (req: Request, res: Response, next: NextFunction) => { 
  let data: Array<UploadData>;

  try {
   data = await handleBotUpload(req, req.data.user);
  } catch(err) {
    return next(err);
  }
  
  if (data.length > 1) return next(new error.BadRequest('Can only upload one tournament bot at a time'));
  let bot = data[0];
  let id = bot.playerID;
  
  // if user is admin, get the actual user the upload is for
  let user = req.data.user;
  if (req.data.dimension.hasDatabase()) {
    if (req.data.dimension.databasePlugin.isAdmin(req.data.user)) {
      user = await req.data.dimension.databasePlugin.getUser(id);
      if (!user) return next(new error.BadRequest('Invalid player ID'));
    }
  }

  let zipLoc = path.join(path.dirname(bot.file), 'bot.zip');

  // upload bot if storage is used
  let botkey: string;
  if (req.data.dimension.hasStorage()) {
    let storage = req.data.dimension.storagePlugin;
    botkey = await storage.uploadTournamentFile(bot.originalFile, user, req.data.tournament);
    
    // as we use storage, we can delete the extracted content safely
    removeDirectorySync(path.dirname(bot.file));
  }
  else {
    // store the zip file
    spawnSync('cp', [bot.originalFile, zipLoc]);
  }
  
  // if no id given, we will generate an ID to use. Generated here using the below function to avoid duplicate ids
  if (!id) {
    id = req.data.tournament.generateNextTournamentIDString();
  }
  if (bot.name || bot.botdir || botkey) {
    req.data.tournament.addplayer({file: bot.file, name: bot.name, zipFile: zipLoc, botdir: bot.botdir, botkey: botkey}, id);
  }
  else {
    req.data.tournament.addplayer(bot.file, id);
  }
  res.json({error: null, message: 'Successfully uploaded bot'});
});





export default router;