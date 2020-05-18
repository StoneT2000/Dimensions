/**
 * API for dimension's matches
 */
import express, { Request, Response, NextFunction } from 'express';
import * as error from '../../../../error';
import { requiresDatabase } from '..';
import { requireAuth } from '../auth';
const router = express.Router();

/**
 * GET
 * Retrieves public user data for the user with the username userid or id userid
 */
router.get('/:userid', requireAuth, (req, res, next) => {
  let dimension = req.data.dimension;
  let publicView = true;
  if (req.data.user.username === req.params.userid || req.data.user.playerID === req.params.userid) {
    publicView = false;
  }
  if (req.data.dimension.databasePlugin.isAdmin(req.data.user)) publicView = false;
  dimension.databasePlugin.getUser(req.params.userid, publicView).then((user) => {
    res.json({error: null, user: user});
  }).catch(next);
});

export default router;