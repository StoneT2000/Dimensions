import express from 'express';
import path from 'path';
import statusAPI from './routes/api/status';
import dimensionsAPI from './routes/api/dimensions';

import { Dimension } from '../Dimension';
import { Match } from '../Match';


// declare global and merge declaration with Express Request to allow storage of data across middlewhere in typescript 
declare global {
  namespace Express {
    interface Request {
      data: {
        dimension?: Dimension,
        match?: Match,
        [x: string]: any
      }
    }
  }
}
export class Station {
  public app: express.Application;
  public static _id: number = 0;
  public id: number = 0;
  public name: string;
  constructor(name: string = '', observedDimensions: Dimension | Array<Dimension>) {
    this.app = express();
    this.app.use(express.static(path.join(__dirname, 'web/build')));
    this.app.get('/', function(req, res) {
      res.sendFile(path.join(__dirname, 'web/build', 'index.html'));
    });
    this.app.listen(9000);
    this.id = Station._id;
    if (name) {
      this.name = name;
    }
    else {
      this.name = `Station_${this.id}`;
    }
    Station._id++;
    console.log(`Running ${this.name} at localhost:9000`);

    // store all observed dimensions
    if (observedDimensions instanceof Array) {
      this.app.set('dimensions', observedDimensions);
    }
    else {
      this.app.set('dimensions', [observedDimensions]);
    }

    // store in each request a data object
    const initReqData = (req, res, next) => {
      req.data = {};
      next();
    }
    this.app.use('/**/*', initReqData)
    
    /**
     * Link up routes
     */
    this.app.use('/api/status', statusAPI);
    this.app.use('/api/dimensions', dimensionsAPI);
    
  }
}