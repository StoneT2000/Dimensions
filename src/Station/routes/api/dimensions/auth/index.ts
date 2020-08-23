/**
 * API for dimension's matches
 */
import express, { Request, Response, NextFunction } from 'express';
import * as error from '../../../../error';
import { requiresDatabase } from '..';
import { Database } from '../../../../../Plugin/Database';
const router = express.Router();

/**
 * Auth requiring middleware
 */
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.data.dimension.hasDatabase()) {
    next();
    return;
  }
  const authHeader = req.get('Authorization');
  if (!authHeader) return next(new error.Unauthorized('Missing auth token'));
  const authHead = authHeader.split(' ');
  const invalidAuthFormat =
    authHead.length !== 2 ||
    authHead[0] !== 'Bearer' ||
    authHead[1].length === 0;
  if (invalidAuthFormat)
    return next(new error.Unauthorized('Invalid auth token format'));
  let dimension = req.data.dimension;
  dimension.databasePlugin
    .verifyToken(authHead[1])
    .then((data) => {
      req.data.user = data;
      next();
    })
    .catch(next);
};

/**
 * Doesn't require auth, just stores user data if supplied
 */
export const storeAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.data.dimension.hasDatabase()) {
    next();
    return;
  }
  const authHeader = req.get('Authorization');
  if (!authHeader) return next();
  const authHead = authHeader.split(' ');
  const invalidAuthFormat =
    authHead.length !== 2 ||
    authHead[0] !== 'Bearer' ||
    authHead[1].length === 0;
  if (invalidAuthFormat) return next();
  let dimension = req.data.dimension;
  dimension.databasePlugin
    .verifyToken(authHead[1])
    .then((data) => {
      req.data.user = data;
      next();
    })
    .catch(() => {
      next();
    });
};

/**
 * Admin requiring middleware
 */
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.data.dimension.hasDatabase()) {
    next();
    return;
  }
  const authHeader = req.get('Authorization');
  if (!authHeader) return next(new error.Unauthorized('Missing auth token'));
  const authHead = authHeader.split(' ');
  const invalidAuthFormat =
    authHead.length !== 2 ||
    authHead[0] !== 'Bearer' ||
    authHead[1].length === 0;
  if (invalidAuthFormat)
    return next(new error.Unauthorized('Invalid auth token format'));
  let dimension = req.data.dimension;
  dimension.databasePlugin
    .verifyToken(authHead[1])
    .then((data) => {
      if (dimension.databasePlugin.isAdmin(data)) {
        req.data.user = data;
        next();
      } else {
        next(new error.Unauthorized('Requires admin access'));
      }
    })
    .catch(next);
};

/**
 * POST
 * Registers a user. Requires username, password in body. Optional userData is passed
 */
router.post('/register', (req, res, next) => {
  if (!req.body.username) return next(new error.BadRequest('Missing username'));
  if (!req.body.password) return next(new error.BadRequest('Missing password'));

  let dimension = req.data.dimension;
  dimension.databasePlugin
    .registerUser(req.body.username, req.body.password, req.body.userData)
    .then((user) => {
      res.json({ error: null, msg: 'success' });
    })
    .catch(next);
});

/**
 * POST
 * Logins a user. Requires username, password in body
 * Returns a jwt
 */
router.post('/login', (req, res, next) => {
  if (!req.body.username) return next(new error.BadRequest('Missing username'));
  if (!req.body.password) return next(new error.BadRequest('Missing password'));

  let dimension = req.data.dimension;
  dimension.databasePlugin
    .loginUser(req.body.username, req.body.password)
    .then((jwt) => {
      res.json({ error: null, token: jwt });
    })
    .catch(next);
});

/**
 * POST
 * Verifies a user's token
 */
router.post('/verify', (req, res, next) => {
  const authHeader = req.get('Authorization');
  if (!authHeader)
    return res.json({
      error: 'Auth token must be specified',
      authenticated: false,
    });

  const authHead = authHeader.split(' ');
  const invalidAuthFormat =
    authHead.length !== 2 ||
    authHead[0] !== 'Bearer' ||
    authHead[1].length === 0;
  if (invalidAuthFormat)
    return res.json({
      error: 'Invalid auth token format',
      authenticated: false,
    });

  let dimension = req.data.dimension;
  dimension.databasePlugin
    .verifyToken(authHead[1])
    .then(() => {
      res.json({ error: null });
    })
    .catch(next);
});

export default router;
