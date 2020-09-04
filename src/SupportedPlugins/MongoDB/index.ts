import mongoose from 'mongoose';
import { Plugin } from '../../Plugin';
import { Database } from '../../Plugin/Database';
import { Dimension, DatabaseType, NanoID } from '../../Dimension';
import MatchSchemaCreator from './models/match';
import { Match } from '../../Match';
import { DeepPartial } from '../../utils/DeepPartial';
import { pickMatch } from '../../Station/routes/api/dimensions/match';
import bcrypt from 'bcryptjs';
import UserSchemaCreator from './models/user';

import { generateToken, verify } from '../../Plugin/Database/utils';
import { Tournament } from '../../Tournament';
import { pick } from '../../utils';
import { nanoid } from '../..';
import TournamentConfigSchema from './models/tournamentConfig';
import { TournamentStatus } from '../../Tournament/TournamentStatus';
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
const salt = bcrypt.genSaltSync();

export class MongoDB extends Database {
  public name = 'MongoDB';
  public type = Plugin.Type.DATABASE;
  public db: mongoose.Connection;
  public mongoose: mongoose.Mongoose;

  public models: MongoDB.Models = {
    user: null,
    match: null,
    tournamentConfigs: null,
  };

  /** The MongoDB connection string used to connect to the database and read/write to it */
  public connectionString: string;

  constructor(
    connectionString: string,
    configs: DeepPartial<Database.Configs> = {}
  ) {
    super(configs);
    this.mongoose = new mongoose.Mongoose({ useUnifiedTopology: true });
    this.mongoose.set('useCreateIndex', true);
    this.mongoose.set('useFindAndModify', false);
    this.connectionString = connectionString;

    const matchSchema = MatchSchemaCreator();
    this.models.match = this.mongoose.model('Match', matchSchema);
    const userSchema = UserSchemaCreator();
    this.models.user = this.mongoose.model('User', userSchema);

    this.models.tournamentConfigs = this.mongoose.model(
      'TournamentConfigs',
      TournamentConfigSchema
    );
  }

  /**
   * Connects to the mongo database and returns the Connection object
   */
  public async connect(): Promise<mongoose.Connection> {
    this.mongoose.connect(this.connectionString, { useNewUrlParser: true });
    this.db = this.mongoose.connection;
    this.db.on('error', console.error.bind(console, 'connection error:'));
    return this.db;
  }

  public async initialize(): Promise<void> {
    await this.connect();
    // create admin user
    const existingUser = await this.getUser('admin');
    if (!existingUser) {
      await this.registerUser('admin', process.env.ADMIN_PASSWORD);
    }

    return;
  }

  public async storeMatch(match: Match, governID: nanoid): Promise<any> {
    const data = { ...pickMatch(match), governID: governID };
    // store all relevant data
    return this.models.match.create(data);
  }
  public async getMatch(id: NanoID): Promise<any> {
    return this.models.match.findOne({ id: id });
  }

  public async getPlayerMatches(
    playerID: nanoid,
    governID: nanoid,
    offset = 0,
    limit = 10,
    order = -1
  ): Promise<Array<Match>> {
    return this.models.match.aggregate([
      {
        $match: {
          governID: {
            $eq: governID,
          },
          'agents.tournamentID.id': {
            $eq: playerID,
          },
        },
      },
      {
        $sort: {
          creationDate: order,
        },
      },
      {
        $skip: offset,
      },
      {
        $limit: limit,
      },
    ]);
  }

  public async registerUser(
    username: string,
    password: string,
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    userData?: any
  ): Promise<any> {
    const hash = bcrypt.hashSync(password, salt);
    return this.models.user.create({
      username: username,
      passwordHash: hash,
      statistics: {},
      meta: {
        ...userData,
      },
    });
  }

  /**
   * Gets user information. If public is false, will retrieve all information other than password
   * @param usernameOrID
   */
  public async getUser(
    usernameOrID: string,
    publicView = true
  ): Promise<Database.User> {
    return this.models.user
      .findOne({
        $or: [{ username: usernameOrID }, { playerID: usernameOrID }],
      })
      .then((user) => {
        let obj: Database.User;
        if (user) {
          obj = user.toObject();
          if (!publicView) return obj;
          const d = <Database.User>(
            pick(
              obj,
              'creationDate',
              'meta',
              'statistics',
              'playerID',
              'username'
            )
          );
          obj = { ...d, passwordHash: '' };
          return obj;
        }
        return null;
      });
  }

  public async loginUser(username: string, password: string): Promise<string> {
    return this.models.user
      .findOne({ username: username })
      .then((user: mongoose.Document & Database.User) => {
        if (user) {
          if (bcrypt.compareSync(password, user.passwordHash)) {
            return generateToken(user);
          } else {
            throw new Error('Invalid password');
          }
        } else {
          throw new Error('Not a valid user');
        }
      });
  }

  public async updateUser(
    usernameOrID: string,
    update: Partial<Database.User>
  ): Promise<Database.User> {
    return this.models.user
      .findOneAndUpdate(
        { $or: [{ username: usernameOrID }, { playerID: usernameOrID }] },
        update
      )
      .then((user) => {
        if (user) {
          return user.toObject();
        } else {
          throw new Error('Not a valid user');
        }
      });
  }

  public async deleteUser(usernameOrID: string): Promise<void> {
    return this.models.user
      .findOneAndDelete({
        $or: [{ username: usernameOrID }, { playerID: usernameOrID }],
      })
      .then((user) => {
        if (!user) {
          throw new Error('Not a valid user');
        }
      });
  }

  public async verifyToken(jwt: string): Promise<string> {
    return verify(jwt);
  }

  public isAdmin(user: Database.PublicUser): boolean {
    if (user.username === 'admin') return true;
    return false;
  }

  public async getUsersInTournament(
    tournamentKey: string,
    offset = 0,
    limit = -1
  ): Promise<Array<Database.User>> {
    const key = `statistics.${tournamentKey}`;
    if (limit == -1) {
      limit = 0;
    } else if (limit == 0) {
      return [];
    }
    return this.models.user
      .find({ [key]: { $exists: true } })
      .skip(offset)
      .limit(limit)
      .then((users) => {
        const mapped = users.map((user) => user.toObject());
        return mapped;
      });
  }

  public async manipulate(dimension: Dimension): Promise<void> {
    dimension.configs.backingDatabase = DatabaseType.MONGO;
    return;
  }

  public async storeTournamentConfigs(
    tournamentID: nanoid,
    tournamentConfigs: Tournament.TournamentConfigsBase,
    status: TournamentStatus
  ): Promise<void> {
    return this.models.tournamentConfigs.updateOne(
      { id: tournamentID },
      {
        configs: tournamentConfigs,
        id: tournamentID,
        status: status,
        modificationDate: new Date(),
      },
      { upsert: true }
    );
  }

  public async getTournamentConfigsModificationDate(
    tournamentID: nanoid
  ): Promise<Date> {
    return this.models.tournamentConfigs
      .findOne({ id: tournamentID })
      .select({ modificationDate: 1 })
      .then((date) => {
        if (date) {
          return new Date(date.toObject().modificationDate);
        } else {
          return null;
        }
      });
  }
  public async getTournamentConfigs(
    tournamentID: nanoid
  ): Promise<{
    configs: Tournament.TournamentConfigsBase;
    status: Tournament.Status;
  }> {
    return this.models.tournamentConfigs
      .findOne({ id: tournamentID })
      .then((data) => {
        if (data) {
          return data.toObject();
        } else {
          return null;
        }
      });
  }
}
export namespace MongoDB {
  /**
   * See {@link Match} class for what these fields represent. They are copied here letter for letter. If set true, the
   * field will be included into the database
   */
  export interface MatchSchemaOptions {
    state: boolean;
    results: boolean;
    creationDate: boolean;
    finishDate: boolean;
    agents: boolean;
  }

  /**
   * User Schema Options. If set to true, that field will be included into the database.
   */
  export interface UserSchemaOptions {
    /** Creation date of the user */
    creationDate: boolean;
  }

  export interface Models {
    user: mongoose.Model<mongoose.Document, object>;
    match: mongoose.Model<mongoose.Document, object>;
    tournamentConfigs: mongoose.Model<mongoose.Document, object>;
  }
}
