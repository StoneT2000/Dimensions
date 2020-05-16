import mongoose from 'mongoose';
import { Plugin } from '../Plugin';
import { Database } from '../Plugin/Database';
import { Dimension, DatabaseType, NanoID } from '../Dimension';
import MatchSchemaCreator from './models/match';
import { Match } from '../Match';
import { DeepPartial } from '../utils/DeepPartial';
import { pickMatch } from '../Station/routes/api/dimensions/match';
import bcrypt from 'bcryptjs';
import UserSchemaCreator from './models/user';
import { generateToken, verify } from '../Plugin/Database/utils';
import { Tournament } from '../Tournament';
const salt = bcrypt.genSaltSync();

export class MongoDB extends Database {
  public name = 'MongoDB';
  public type = Plugin.Type.DATABASE;
  public db: mongoose.Connection;

  public models: MongoDB.Models = {
    user: null,
    match: null
  }

  /** The MongoDB connection string used to connect to the database and read/write to it */
  public connectionString: string;

  constructor(connectionString: string, configs: DeepPartial<Database.Configs> = {}) {
    super(configs);
    this.connectionString = connectionString;
    let matchSchema = MatchSchemaCreator();
    this.models.match = mongoose.model('Match', matchSchema);
    let userSchema = UserSchemaCreator();
    this.models.user = mongoose.model('User', userSchema);
  }

  /**
   * Connects to the mongo database and returns the Connection object
   */
  public async connect(): Promise<mongoose.Connection> {
    mongoose.connect(this.connectionString, {useNewUrlParser: true});
    this.db = mongoose.connection;
    this.db.on('error', console.error.bind(console, 'connection error:'));
    return this.db;
  }
  
  public async initialize() {
    await this.connect();
    return;
  }

  public async storeMatch(match: Match): Promise<any> {
    let data = pickMatch(match);
    // store all relevant data
    return this.models.match.create(data);
  }
  public async getMatch(id: NanoID) {
    return this.models.match.findOne({id: id});
  }

  public async registerUser(username: string, password: string, userData?: any) {
    const hash = bcrypt.hashSync(password, salt);
    return this.models.user.create({
      username: username,
      passwordHash: hash,
      statistics: {}
    });
  }

  /**
   * Gets user information. If public is false, will retrieve all information other than password
   * @param usernameOrID 
   */
  public async getUser(usernameOrID: string, publicView: boolean = true) {
    return this.models.user.findOne( {$or: [ { username: usernameOrID }, { playerID: usernameOrID } ]} ).then((user) => {
      if (user) return user.toObject();
      return null;
    });
  } 

  public async loginUser(username: string, password: string) {
    return this.models.user.findOne({ username: username}).then((user: mongoose.Document & Database.User) => {
      if (user) {
        if (bcrypt.compareSync(password, user.passwordHash)) {
          return generateToken(user);
        }
        else {
          throw new Error('Invalid password');
        }
      }
      else {
        throw new Error('Not a valid user');
      }
    });
  }

  public async updateUser(usernameOrID: string, update: Partial<Database.User>) {
    return this.models.user.findOneAndUpdate({$or: [ { username: usernameOrID }, { playerID: usernameOrID } ]}, update).then((user) => {
      if (user) {
        return user.toObject();
      }
      else {
        throw new Error('Not a valid user');
      }
    });
  }

  public async deleteUser(usernameOrID: string) {
    return this.models.user.findOneAndDelete( {$or: [ { username: usernameOrID }, { playerID: usernameOrID } ]} ).then((user) => {
      if (!user) {
        throw new Error('Not a valid user');
      }
    });
  }

  public async verifyToken(jwt: string) {
    return verify(jwt);
  }

  public async getUsersInTournament(tournamentKey: string) {
    let key = `statistics.${tournamentKey}`;
    return this.models.user.find({ [key]: {$exists: true}}).then((users) => {
      if (!users) {
        throw new Error('No users');
      }
      else {
        let mapped = users.map(user => user.toObject());
        return mapped;
      }
    });
  }

  public async manipulate(dimension: Dimension) {
    dimension.configs.backingDatabase = DatabaseType.MONGO;
    return;
  }
}
export module MongoDB {

  /**
   * See {@link Match} class for what these fields represent. They are copied here letter for letter. If set true, the
   * field will be included into the database
   */
  export interface MatchSchemaOptions {
    state: boolean,
    results: boolean
    creationDate: boolean,
    finishDate: boolean,
    agents: boolean
  }

  /**
   * User Schema Options. If set to true, that field will be included into the database.
   */
  export interface UserSchemaOptions {
    /** Creation date of the user */
    creationDate: boolean,
  }

  export interface Models {
    user: mongoose.Model<mongoose.Document, {}>,
    match: mongoose.Model<mongoose.Document, {}>
  }
}