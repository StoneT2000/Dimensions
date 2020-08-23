/**
 * API for dimension's matches
 */
import express from 'express';
import { requireAuth, storeAuth } from '../auth';
const router = express.Router();

/**
 * GET
 * Retrieves public user data for the user with the username userid or id userid
 */
router.get('/:userid', storeAuth, (req, res, next) => {
  const dimension = req.data.dimension;
  let publicView = true;
  if (req.data.user) {
    if (
      req.data.user.username === req.params.userid ||
      req.data.user.playerID === req.params.userid
    ) {
      publicView = false;
    }
    if (req.data.dimension.databasePlugin.isAdmin(req.data.user))
      publicView = false;
  }
  dimension.databasePlugin
    .getUser(req.params.userid, publicView)
    .then((user) => {
      res.json({ error: null, user: user });
    })
    .catch(next);
});

router.get('/', requireAuth, (req, res, next) => {
  const dimension = req.data.dimension;
  const publicView = false;
  dimension.databasePlugin
    .getUser(req.data.user.playerID, publicView)
    .then((user) => {
      res.json({ error: null, user: user });
    })
    .catch(next);
});

export default router;
