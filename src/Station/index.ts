import express from 'express';
import path from 'path';
import status from './routes/api/status';
import dimensionsAPI from './routes/api/dimensions';

import { Dimension } from '../Dimension';

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
    
    /**
     * Link up routes
     */
    this.app.use('/api/status', status);
    this.app.use('/api/dimensions', dimensionsAPI);
    
  }
}