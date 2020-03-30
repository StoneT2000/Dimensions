/**
 * API for using a dimension through just a browser
 */
import express, { Request, Response } from 'express';
const router = express.Router();

router.get('/test', (req:Request, res: Response) => res.send('API online!'));

// Get a dimension and its details
router.get('/:id/', (req, res) => {
  let dimensionID = req.params.id;
  let matchingDimensions = req.app.get('dimensions').filter((d) => d.id == dimensionID);

  if (matchingDimensions.length) {
    res.json({error: null, dimension: matchingDimensions[0]});
  }
  else {
    res.json({error: 'No dimension found'})
  }
});


export default router