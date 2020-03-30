import express from 'express';
import path from 'path';
import statusAPI from './routes/api/status';
import dimensionsAPI from './routes/api/dimensions';

import { Dimension } from '../Dimension';
import { Logger, LoggerLEVEL } from '../Logger';
import { Match } from '../Match';

import * as error from './error';

import cors from 'cors';
import { Server } from 'http';

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
  public port: number = 9000;

  public maxAttempts:number = 16;
  private log: Logger = new Logger(Logger.LEVEL.INFO, 'Station Log');
  private server: Server;
  constructor(name: string = '', observedDimensions: Dimension | Array<Dimension>, loggingLevel?: LoggerLEVEL) {
    this.app = express();

    this.log.level = loggingLevel;

    // CORS
    this.app.use(cors());

    // serve the web app
    this.app.use(express.static(path.join(__dirname, 'web/build')));
    this.app.get('/', function(req, res) {
      res.sendFile(path.join(__dirname, 'web/build', 'index.html'));
    });

    // store ID, set name and logger identifier
    this.id = Station._id;
    if (name) {
      this.name = name;
    }
    else {
      this.name = `Station_${this.id}`;
    }
    Station._id++;

    this.log.identifier = this.name + ' Log';
    

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
     * Status - Status of everything
     * Dimensions - Api to access all dimensions functions, match functions, etc.
     */
    this.app.use('/api/status', statusAPI);
    this.app.use('/api/dimensions', dimensionsAPI);

    // Set up error handler
    this.app.use(error.errorHandler);

    this.log.system(`All middleware setup`);

    this.tryToListenToOpenPort();
    
  }

  private async tryToListenToOpenPort() {
    // Successful start of app messages and setups
    const successStart = () => {
      this.log.infobar();
      this.log.info(`Running ${this.name} at localhost:${this.port}`);
      this.log.info(`Observing dimensions: ${this.app.get('dimensions').map((dim: Dimension) => dim.name)}`);
    }

    // Try to listen and run successStart, otherwise print error
    this.tryToListen().then(() => {
      successStart();
    }).catch(() => {
      this.log.error(`Station: ${this.name}, couldn't find an open port after 16 attempts`);
    })
  }

  /**
   * Try to listen to this.maxAttempts ports
   */
  private async tryToListen() {
    // Try to listen function without breaking if port is busy. try up to an 16 ports (16 is arbitrary #)
    let attempts = 0;
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port).on('error', () => {
        attempts++;
        // this.log.warn(`${this.name} - Failed attempt ${attempts}`);
        this.port++;
        if (attempts < this.maxAttempts) {
          this.tryToListen().then(resolve);
        }
        else {
          reject();
        }
      }).on('listening', resolve)
    })
  }

  /**
   * Restart Station server
   */
  public async restart() {
    return new Promise((resolve, reject) => {
      this.log.warn("RESTARTING");
      this.server.close((err) => {
        if (err) reject(err);
        this.tryToListenToOpenPort().then(resolve).catch(reject)
      });
    })
  }

  public observe(dimension: Dimension) {
    this.app.set('dimensions', [...this.app.get('dimensions'), dimension]);
  }
}