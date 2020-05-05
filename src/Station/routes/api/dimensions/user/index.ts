/**
 * API for dimension's matches
 */
import express, { Request, Response, NextFunction } from 'express';
import * as error from '../../../../error';
import { requiresDatabase } from '..';
const router = express.Router();

/**
 * GET
 * Retrieves public user data for the user with the username userid or id userid
 */
router.get('/:userid', (req, res, next) => {
  let dimension = req.data.dimension;
  dimension.databasePlugin.getUser(req.params.userid).then((user) => {
    res.json({error: null, user: user});
  }).catch(next);
});

export default router;