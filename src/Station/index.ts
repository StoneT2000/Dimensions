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

  public webport: number = 3000;

  public maxAttempts:number = 16;
  private log: Logger = new Logger(Logger.LEVEL.INFO, 'Station Log');
  private server: Server;
  public webapp: express.Application;
  constructor(name: string = '', observedDimensions: Dimension | Array<Dimension>, loggingLevel?: LoggerLEVEL) {
    // set logging level
    this.log.level = loggingLevel;
    

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
     

    this.app = express(); // api app
    this.webapp = express(); // web app

    // CORS
    this.webapp.use(cors());
    
    this.webapp.use(express.static(path.join(__dirname, 'web/build')));
    this.webapp.get('/*', function (req, res) {
      res.sendFile(path.join(__dirname, 'web/build', 'index.html'));
    });

    // Try to start up web app
    const webSuccessStart = () => {
      this.log.infobar();
      this.log.info(`Running '${this.name}' Web at http://localhost:${this.webport}`);
    }
    this.tryToListen(this.webapp, this.webport).then((port: number) => {
      this.webport = port;
      webSuccessStart();
    }).catch(() => {
      this.log.error(`Station Web: ${this.name}, couldn't find an open port after 16 attempts`);
    })

   

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

    // Successful start of app messages and setups
    const successStart = () => {
      this.log.infobar();
      this.log.info(`Running '${this.name}' API at port ${this.port}`);
      this.log.info(`Observing dimensions: ${this.app.get('dimensions').map((dim: Dimension) => dim.name)}`);
    }
    this.tryToListen(this.app, this.port).then((port: number) => {
      this.port = port;
      successStart();
    }).catch(() => {
      this.log.error(`Station: ${this.name}, couldn't find an open port after 16 attempts`);
    })
    
  }
  /**
   * Try to listen to this.maxAttempts ports
   */
  private async tryToListen(app: express.Application, startingPort: number) {
    // Try to listen function without breaking if port is busy. try up to an 16 ports (16 is arbitrary #)
    let attempts = 0;
    return new Promise((resolve, reject) => {
      this.server = app.listen(startingPort).on('error', () => {
        attempts++;
        // this.log.warn(`${this.name} - Failed attempt ${attempts}`);
        if (attempts < this.maxAttempts) {
          this.tryToListen(app, startingPort + 1).then(() => {
            resolve(startingPort + 1)
          });
        }
        else {
          reject();
        }
      }).on('listening', () => {
        resolve(startingPort);
      });
    })
  }

  /**
   * Restart Station server / API
   */
  public async restart() {
    return new Promise((resolve, reject) => {
      this.log.warn("RESTARTING");
      this.server.close((err) => {
        if (err) reject(err);
        this.tryToListen(this.app, this.port).then(resolve).catch(reject)
      });
    })
  }

  public observe(dimension: Dimension) {
    this.app.set('dimensions', [...this.app.get('dimensions'), dimension]);
  }
}