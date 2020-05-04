import mongoose from 'mongoose';
import { Plugin, DatabasePlugin } from '../Plugin';
import { Dimension, DatabaseType } from '../Dimension';
import MatchSchemaCreator from './models/match';
import { Match } from '../Match';
import { DeepPartial } from '../utils/DeepPartial';
import { pickMatch } from '../Station/routes/api/dimensions/match';

export class MongoDB extends DatabasePlugin {
  public name = 'MongoDB';
  public type = Plugin.Type.DATABASE;
  public db: mongoose.Connection;

  public models: MongoDB.Models = {
    user: null,
    match: null
  }

  /** The MongoDB connection string used to connect to the database and read/write to it */
  public connectionString: string;

  constructor(connectionString: string, configs: DeepPartial<DatabasePlugin.Configs> = {}) {
    super(configs);
    this.connectionString = connectionString;
    let matchSchema = MatchSchemaCreator();
    this.models.match = mongoose.model('Match', matchSchema);
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
    return this.models.match.create(data);
  }
  public async getMatch(id: Match.ID) {
    return this.models.match.findOne({id: id});
  }


  public async manipulate(dimension: Dimension) {
    dimension.configs.backingDatabase = DatabaseType.MONGO;
    return;
  }
}
export module MongoDB {

  /**
   * See {@link Match} class for what these fields represent. They are copied here letter for letter
   */
  export interface MatchSchemaOptions {
    state: boolean,
    results: boolean
    creationDate: boolean,
    finishDate: boolean,
    agents: boolean
  }
  export interface Models {
    user: mongoose.Model<mongoose.Document, {}>,
    match: mongoose.Model<mongoose.Document, {}>
  }
}