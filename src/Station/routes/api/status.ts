/**
 * API route for getting statuses of running matches, tournaments etc. of a dimension
 */
import express, { Request, Response } from 'express';
const router = express.Router();

router.get('/test', (req:Request, res: Response) => res.send('API online!'));

router.get('/dimensions', (req, res) => {
  // console.log(req.app.get('dimensions'));
  res.json(req.app.get('dimensions'));
  res.send(JSON.stringify(res.app));
});


export default router


