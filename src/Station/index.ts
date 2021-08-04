import express, { NextFunction } from 'express';
import path from 'path';
import statusAPI from './routes/api/status';
import dimensionsAPI from './routes/api/dimensions';

import { Dimension } from '../Dimension';
import { Logger } from '../Logger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Match } from '../Match';

import * as error from './error';

import cors from 'cors';
import bodyParser from 'body-parser';
import { Server } from 'http';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Tournament } from '../Tournament';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Agent } from '../Agent';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Plugin } from '../Plugin';
import { DeepPartial } from '../utils/DeepPartial';
import { deepMerge } from '../utils/DeepMerge';
import { deepCopy } from '../utils/DeepCopy';

export const BOT_DIR = path.join(__dirname, '../../../../local/bots');

// declare global and merge declaration with Express Request to allow storage of data across middleware in typescript
declare global {
  namespace Express {
    interface Request {
      data: {
        dimension?: Dimension;
        match?: Match;
        tournament?: Tournament;
        agent?: Agent;
        user?: Plugin.Database.User;
        [x: string]: any;
      };
    }
  }
}
export class Station {
  public app: express.Application;
  public static _id = 0;
  public id = 0;
  public name: string;
  public port = 9000;

  public webport = 3000;

  public maxAttempts = 16;
  private log: Logger = new Logger(Logger.LEVEL.INFO, 'Station Log');
  private server: Server;

  public configs: Station.Configs = {
    disableUploads: false,
    loggingLevel: Logger.LEVEL.INFO,
    requireAuth: true,
  };

  constructor(
    name = '',
    observedDimensions: Dimension | Array<Dimension>,
    configs: DeepPartial<Station.Configs> = {}
  ) {
    this.configs = deepMerge(this.configs, deepCopy(configs));

    // set logging level
    this.log.level = this.configs.loggingLevel;

    // store ID, set name and logger identifier
    this.id = Station._id;
    if (name) {
      this.name = name;
    } else {
      this.name = `Station_${this.id}`;
    }
    Station._id++;

    this.log.identifier = this.name + ' Log';

    this.app = express(); // api app

    // CORS
    this.app.use(cors());
    this.app.use(bodyParser.json());
    this.app.use(
      bodyParser.urlencoded({
        extended: true,
      })
    );

    // store all observed dimensions
    if (observedDimensions instanceof Array) {
      const dimensionsMap = new Map();
      observedDimensions.forEach((dim) => {
        dimensionsMap.set(dim.id, dim);
      });
      this.app.set('dimensions', dimensionsMap);
    } else {
      const m = new Map();
      m.set(observedDimensions.id, observedDimensions);
      this.app.set('dimensions', m);
    }

    // store in each request a data object
    const initReqData = (
      req: Express.Request,
      res: Express.Response,
      next: NextFunction
    ) => {
      req.data = {};
      next();
    };
    this.app.use('/**/*', initReqData);

    this.app.get('/', (req, res) => {
      res.json({ msg: 'api live at /api' });
    });
    this.app.get('/api', (req, res) => {
      res.json({ msg: 'api live at /api' });
    });

    /**
     * Link up routes
     * Status - Status of everything
     * Dimensions - Api to access all dimensions functions, match functions, etc.
     */
    this.app.use('/api/status', statusAPI);
    this.app.use('/api/dimensions', dimensionsAPI);

    // Set up error handler
    this.app.use(error.errorHandler(this.log));

    this.log.system(`All middleware setup`);

    // Successful start of app messages and setups
    const successStart = () => {
      this.log.info(
        `Running '${this.name}' API at port ${this.port}. API served at http://localhost:${this.port}`
      );
      const dims = [];
      this.app
        .get('dimensions')
        .forEach((dim: Dimension) => dims.push(dim.name));
      this.log.info(`Observing dimensions: ${dims}`);
    };
    this.tryToListen(this.app, this.port)
      .then((port: number) => {
        this.port = port;
        successStart();
      })
      .catch(() => {
        this.log.error(
          `Station: ${this.name}, couldn't find an open port after 16 attempts`
        );
      });
  }
  /**
   * Try to listen to this.maxAttempts ports. Resolves with the port nunber used
   */
  private tryToListen(
    app: express.Application,
    startingPort: number
  ): Promise<number> {
    // Try to listen function without breaking if port is busy. try up to an 16 ports (16 is arbitrary #)
    let attempts = 0;
    return new Promise((resolve, reject) => {
      this.server = app
        .listen(startingPort)
        .on('error', () => {
          attempts++;
          // this.log.warn(`${this.name} - Failed attempt ${attempts}`);
          if (attempts < this.maxAttempts) {
            this.tryToListen(app, startingPort + 1).then(() => {
              resolve(startingPort + 1);
            });
          } else {
            reject();
          }
        })
        .on('listening', () => {
          resolve(startingPort);
        });
    });
  }

  public setLogLevel(level: Logger.LEVEL): void {
    this.log.level = level;
  }

  /**
   * Restart Station server / API
   * Resolves with the port number used
   */
  public restart(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.log.warn('RESTARTING');
      this.server.close((err) => {
        if (err) reject(err);
        this.tryToListen(this.app, this.port).then(resolve).catch(reject);
      });
    });
  }

  /**
   * Stop the Station server / API
   */
  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.log.warn('Stopping');
      this.server.close((err) => {
        if (err) reject(err);
        resolve();
      });
    });
  }

  public observe(dimension: Dimension): void {
    const dimMap = this.app.get('dimensions');
    dimMap.set(dimension.id, dimension);
    this.app.set('dimensions', dimMap);
  }
}

export namespace Station {
  export interface Configs {
    /**
     * Whether or not to allow bot uploads through the Station API. Note that you can still upload bots by changing the
     * row entry for the user's bot and updating the botKey and directly calling {@link Tournament.AddPlayer} and
     * providing full detils
     *
     * @default `false`
     */
    disableUploads: boolean;

    /**
     * Logging level of station
     */
    loggingLevel: Logger.LEVEL;

    /**
     * Whether or not requests need to be authenticated with a token or not. If false, all requests are assumed to be
     * the admin
     *
     * @default `true`
     */
    requireAuth: boolean;
  }
}
