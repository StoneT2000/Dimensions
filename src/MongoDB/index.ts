import mongoose from 'mongoose';
import { Plugin, DatabasePlugin } from '../Plugin';
import { Dimension, DatabaseType } from '../Dimension';
import MatchSchemaCreator from './models/match';
import { Match } from '../Match';

export class MongoDB extends DatabasePlugin {
  public type: Plugin.Type.DATABASE;
  public db: mongoose.Connection;

  public models: MongoDB.Models = {
    user: null,
    match: null
  }

  /** The MongoDB connection string used to connect to the database and read/write to it */
  public connectionString: string;

  constructor(connectionString: string) {
    super();
    this.connectionString = connectionString;
    let matchSchema = MatchSchemaCreator();
    this.models.match = mongoose.model('Match', matchSchema);
    // new this.models.match() 
  }

  /**
   * Connects to the mongo database and returns the Connection object
   */
  public connect(): mongoose.Connection {
    mongoose.connect(this.connectionString, {useNewUrlParser: true});
    this.db = mongoose.connection;
    this.db.on('error', console.error.bind(console, 'connection error:'));
    return this.db;
  }
  
  public async initialize() {
    return;
  }

  public async storeMatch(match: Match): Promise<any> {
    let matchData = new this.models.match(match);
    return matchData.save();
  }


  public manipulate(dimension: Dimension) {
    dimension.configs.backingDatabase = DatabaseType.MONGO;
    return;
  }
}
export module MongoDB {
  export interface MatchSchemaOptions {
    state: boolean,
    results: boolean
    creationDate: boolean
  }
  export interface Models {
    user: mongoose.Model<mongoose.Document, {}>,
    match: mongoose.Model<mongoose.Document, {}>
  }
}