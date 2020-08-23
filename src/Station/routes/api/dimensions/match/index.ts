/**
 * API for dimension's matches
 */
import express, { Request, Response, NextFunction } from 'express';
import * as error from '../../../../error';
import { Match } from '../../../../../Match';
import { pick } from '../../../../../utils';
import agentRouter, { pickAgent } from './agent';
import { requireAdmin } from '../auth';
const router = express.Router();

/**
 * Get match by matchID. Requires a tournament or dimension to be stored.
 *
 * For tournaments, it will get a match only if it's active. Otherwise a database plugin is needed in order to retrieve
 * the match. NOTE that the database plugin will not recover all of the same match data as usually returned from active
 * matches
 *
 * For dimension run match (via {@link Dimension.runMatch}), it is retrievable as long as it has not been destroyed
 */
export const getMatch = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let match: Match;
  if (req.data.tournament) {
    match = req.data.tournament.matches.get(req.params.matchID);
  } else if (req.data.dimension) {
    match = req.data.dimension.matches.get(req.params.matchID);
  } else {
    return next(
      new error.BadRequest(
        `System error. match API route was added out of order`
      )
    );
  }
  if (!match) {
    if (req.data.dimension.hasDatabase()) {
      try {
        match = await req.data.dimension.databasePlugin.getMatch(
          req.params.matchID
        );
      } catch (error) {
        return next(error);
      }
    }
  }

  if (!match) {
    return next(
      new error.BadRequest(
        `No match found with name or id of '${req.params.matchID}' in dimension ${req.data.dimension.id} - '${req.data.dimension.name}'`
      )
    );
  }
  req.data.match = match;
  next();
};

/**
 * Pick relevant fields of a match
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const pickMatch = (match: Match) => {
  const picked = {
    ...pick(
      match,
      'configs',
      'creationDate',
      'id',
      'log',
      'mapAgentIDtoTournamentID',
      'matchStatus',
      'name',
      'finishDate',
      'results',
      'replayFileKey',
      'replayFile'
    ),
    agents: [],
  };
  if (match.agents) {
    picked.agents = match.agents.map((agent) => pickAgent(agent));
  }
  return picked;
};

router.use('/:matchID', getMatch);

/**
 * Get match details
 */
router.get('/:matchID', (req, res) => {
  res.json({ error: null, match: pickMatch(req.data.match) });
});

/**
 * Gets whatever is stored in the match results field
 */
router.get('/:matchID/results', (req, res) => {
  res.json({ error: null, results: req.data.match.results || null });
});

/**
 * GET
 *
 * Retrieves replay file
 */
router.get('/:matchID/replay', async (req, res, next) => {
  if (req.data.dimension.hasStorage()) {
    if (req.data.match.replayFileKey) {
      const storage = req.data.dimension.storagePlugin;
      res.send({
        error: null,
        url: await storage.getDownloadURL(req.data.match.replayFileKey),
      });
    } else {
      return next(
        new error.BadRequest(
          'Replay for this match does not exist or was not stored'
        )
      );
    }
  } else {
    if (req.data.match.replayFile) {
      res.sendFile(req.data.match.replayFile);
    } else {
      return next(
        new error.BadRequest(
          'Replay file for this match does not exist or was not stored'
        )
      );
    }
  }
});

/**
 * Gets whatever is stored in the match state
 */
router.get('/:matchID/state', (req, res) => {
  res.json({ error: null, state: req.data.match.state || null });
});

/**
 * POST
 *
 * Run/resume a match if it hasn't initialiized, or was finished, or is currently stopped
 */
router.post(
  '/:matchID/run',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (
        req.data.match.matchStatus === Match.Status.FINISHED ||
        req.data.match.matchStatus === Match.Status.UNINITIALIZED
      ) {
        await req.data.match.initialize();
      } else if (req.data.match.matchStatus === Match.Status.RUNNING) {
        return next(new error.BadRequest('Match is already running'));
      }
      // run or resume the match
      if (req.data.match.matchStatus === Match.Status.STOPPED) {
        req.data.match.resume();
      } else {
        // run and do nothing with the error
        // match should be in ready state
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        req.data.match.run().catch(() => {});
      }
      res.json({ error: null, msg: 'Running Match' });
    } catch (error) {
      return next(new error.InternalServerError('Match Failed to Run'));
    }
  }
);

/**
 * POST
 * Stop a match
 */
router.post(
  '/:matchID/stop',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.data.match.matchStatus === Match.Status.STOPPED) {
      return next(new error.BadRequest('Match is already stopped'));
    }
    if (req.data.match.matchStatus === Match.Status.FINISHED) {
      return next(new error.BadRequest('Match is already finished'));
    }
    if (req.data.match.matchStatus === Match.Status.READY) {
      return next(
        new error.BadRequest(
          "Match hasn't started and can't be stopped as a result"
        )
      );
    }
    if (req.data.match.matchStatus === Match.Status.UNINITIALIZED) {
      return next(new error.BadRequest("Can't stop an uninitialized match"));
    }

    return req.data.match
      .stop()
      .then(() => {
        res.json({ error: null, msg: 'Stopped Match' });
      })
      .catch(() => {
        return next(new error.InternalServerError("Couldn't stop the match"));
      });
  }
);

router.use('/:matchID/agents', agentRouter);

export default router;
