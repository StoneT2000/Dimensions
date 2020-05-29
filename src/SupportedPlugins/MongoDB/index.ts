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
import { Ladder } from '../../Tournament/Ladder';
import { TournamentError } from '../../DimensionError';
import TournamentConfigSchema from './models/tournamentConfig';
import { TournamentStatus } from '../../Tournament/TournamentStatus';
require('dotenv').config();
const salt = bcrypt.genSaltSync();

export class MongoDB extends Database {
  public name = 'MongoDB';
  public type = Plugin.Type.DATABASE;
  public db: mongoose.Connection;

  public models: MongoDB.Models = {
    user: null,
    match: null,
    tournamentConfigs: null
  }

  /** The MongoDB connection string used to connect to the database and read/write to it */
  public connectionString: string;

  constructor(connectionString: string, configs: DeepPartial<Database.Configs> = {}) {
    super(configs);
    mongoose.set('useFindAndModify', false);
    this.connectionString = connectionString;
    let matchSchema = MatchSchemaCreator();
    this.models.match = mongoose.model('Match', matchSchema);
    let userSchema = UserSchemaCreator();
    this.models.user = mongoose.model('User', userSchema);

    this.models.tournamentConfigs = mongoose.model('TournamentConfigs', TournamentConfigSchema);

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
  
  public async initialize(dimension: Dimension) {
    await this.connect();
    // create admin user
    let existingUser = await this.getUser('admin');
    if (!existingUser) {
      await this.registerUser('admin', process.env.ADMIN_PASSWORD);
    }

    return;
  }

  public async storeMatch(match: Match, governID: nanoid): Promise<any> {
    let data = {...pickMatch(match), governID: governID};
    // store all relevant data
    return this.models.match.create(data);
  }
  public async getMatch(id: NanoID) {
    return this.models.match.findOne({id: id});
  }

  public async getPlayerMatches(
    playerID: nanoid, governID: nanoid, offset: number = 0, limit: number = 10, order: number = -1
  ): Promise<Array<Match>> {
    return this.models.match.aggregate(
      [
        { 
          "$match": {
            "governID": {
              "$eq": governID
            },
            "agents.tournamentID.id": {
              "$eq": playerID
            }
          }
        },
        {
          "$sort": {
            "creationDate": order
          }
        },
        {
          "$skip": offset
        },
        {
          "$limit": limit
        }
      ]
    );
  }

  public async getRanks(tournament: Tournament.Ladder, offset: number, limit: number): Promise<Array<Ladder.PlayerStat>> {
    let keyname = tournament.getKeyName();
    if (tournament.configs.rankSystem === Tournament.RANK_SYSTEM.TRUESKILL) {
      let agg: Array<Object> = [
        {
          // select all users with stats in this tournament, implying they are still in the tourney
          "$match":  {
            ["statistics." + keyname]: {
              "$exists": true
            }
          }
        },
        {
          "$project": {
            ["statistics." + keyname]: 1
          }
        },
        {
          "$addFields": {
            "score": {
              "$subtract": [
                `$statistics.${keyname}.rankState.rating.mu`,
                {
                  "$multiply": [`$statistics.${keyname}.rankState.rating.sigma`, 3]
                }
              ]
            }
          }
        },
        {
          "$sort": {
            "score": -1
          }
        },
        {
          "$skip": offset
        }
      ];
      if (limit !== -1) {
        agg.push({
          "$limit": limit
        });
      }
      let rankData = await this.models.user.aggregate(agg);
      return rankData.map((data) => {
        return data.statistics[keyname];
      });

    }
    else if (tournament.configs.rankSystem === Tournament.RANK_SYSTEM.ELO) {
      let agg: Array<Object> = [
        {
          // select all users with stats in this tournament, implying they are still in the tourney
          "$match":  {
            ["statistics." + keyname]: {
              "$exists": true
            }
          }
        },
        {
          "$project": {
            ["statistics." + keyname]: 1
          }
        },
        {
          "$addFields": {
            "score": `$statistics.${keyname}.rankState.rating.score`
          }
        },
        {
          "$sort": {
            "score": -1
          }
        },
        {
          "$skip": offset
        }
      ];
      if (limit !== -1) {
        agg.push({
          "$limit": limit
        });
      }
      let rankData = await this.models.user.aggregate(agg);
      return rankData.map((data) => {
        return data.statistics[keyname];
      });
    }
    else {
      throw new TournamentError("This rank system is not supported for retrieving ranks from MongoDB");
    }
  }

  public async registerUser(username: string, password: string, userData?: any) {
    const hash = bcrypt.hashSync(password, salt);
    return this.models.user.create({
      username: username,
      passwordHash: hash,
      statistics: {},
      meta: {
        ...userData
      }
    });
  }

  /**
   * Gets user information. If public is false, will retrieve all information other than password
   * @param usernameOrID 
   */
  public async getUser(usernameOrID: string, publicView: boolean = true) {
    return this.models.user.findOne( {$or: [ { username: usernameOrID }, { playerID: usernameOrID } ]} ).then((user) => {
      let obj: Database.User;
      if (user) {
        obj = user.toObject();
        if (!publicView) return obj;
        let d = <Database.User>pick(obj, 'creationDate', 'meta', 'statistics', 'playerID', 'username');
        obj = {...d, passwordHash: ""}
        return obj;
      }
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

  public isAdmin(user: Database.PublicUser) {
    if (user.username === 'admin') return true;
    return false;
  }

  public async getUsersInTournament(tournamentKey: string, offset: number = 0, limit: number = -1) {
    let key = `statistics.${tournamentKey}`;
    if (limit == -1) {
      limit = 0;
    }
    else if (limit == 0) {
      return [];
    }
    return this.models.user.find({ [key]: {$exists: true} }).skip(offset).limit(limit).then((users) => {
      let mapped = users.map(user => user.toObject());
      return mapped;
    });
  }

  public async manipulate(dimension: Dimension) {
    dimension.configs.backingDatabase = DatabaseType.MONGO;
    return;
  }

  public async storeTournamentConfigs(tournamentID: nanoid, tournamentConfigs: Tournament.TournamentConfigsBase, status: TournamentStatus) {
    return this.models.tournamentConfigs.updateOne({ id: tournamentID }, { configs: tournamentConfigs, id: tournamentID, status: status, modificationDate: new Date()}, { upsert: true });
  }

  public async getTournamentConfigsModificationDate(tournamentID: nanoid) {
    return this.models.tournamentConfigs.findOne({ id: tournamentID }).select({ modificationDate: 1 }).then((date) => {
      if (date) {
        return new Date(date.toObject().modificationDate);
      }
      else {
        return null;
      }
      
    });
  }
  public async getTournamentConfigs(tournamentID: nanoid) {
    return this.models.tournamentConfigs.findOne({ id: tournamentID }).then((data) => {
      if (data) {
        return data.toObject();
      }
      else {
        return null;
      }
    });
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
    match: mongoose.Model<mongoose.Document, {}>,
    tournamentConfigs: mongoose.Model<mongoose.Document, {}>
  }
}