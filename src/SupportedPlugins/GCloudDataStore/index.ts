import { Database } from "../../Plugin/Database";
import { DeepPartial } from "../../utils/DeepPartial";
import { Dimension, NanoID } from "../../Dimension";
import { Match } from "../../Match";
import { Tournament, Player } from "../../Tournament";
import { Ladder } from "../../Tournament/Ladder";
import { TournamentError } from "../../DimensionError";
import { verify } from "../../Plugin/Database/utils";
import { Plugin } from "../../Plugin";
import bcrypt from 'bcryptjs';

import { Datastore } from '@google-cloud/datastore';
import { pickMatch } from "../../Station/routes/api/dimensions/match";


require('dotenv').config();
const salt = bcrypt.genSaltSync();

export class GCloudDataStore extends Database {
  public name = 'GCloud Data Store';
  public type = Plugin.Type.DATABASE;

  public datastore: Datastore;

  constructor(gcpConfigs: GCloudDataStore.Configs, configs: DeepPartial<Database.Configs> = {}) {
    super(configs);
    this.datastore = new Datastore({keyFile: gcpConfigs.keyFile});
  }

  public async initialize(dimension: Dimension) {
    let existingUser = await this.getUser('admin');
    
    if (!existingUser) {
      await this.registerUser('admin', process.env.ADMIN_PASSWORD);
    }
    return;
  }

  public async storeMatch(match: Match, governID: NanoID): Promise<any> {
    let data = {...pickMatch(match), governID: governID};
    // // store all relevant data
    const key = this.getMatchDatastoreKey(match.id);
    return this.datastore.save({
      key: key,
      data: data,
    })
  }
  public async getMatch(id: NanoID) {
    // return this.models.match.findOne({id: id});
    const key = this.getMatchDatastoreKey(id);
    return (await this.datastore.get(key))[0];
  }

  public async getPlayerMatches(
    playerID: NanoID, governID: NanoID, offset: number = 0, limit: number = 10, order: number = -1
  ): Promise<Array<Match>> {
    const query = this.datastore.createQuery(GCloudDataStore.Kinds.MATCHES).filter("agents.tournamentID.id", "=", playerID).filter("governID", "=", governID).offset(offset).limit(limit).order("creationDate", { descending: true })
    return (await this.datastore.runQuery(query))[0];
  }

  public async getRanks(tournament: Tournament.Ladder, offset: number, limit: number): Promise<Array<Ladder.PlayerStat>> {
    let keyname = tournament.getKeyName();
    if (tournament.configs.rankSystem === Tournament.RANK_SYSTEM.TRUESKILL) {

    }
    else if (tournament.configs.rankSystem === Tournament.RANK_SYSTEM.ELO) {
      
    }
    else {
      throw new TournamentError("This rank system is not supported for retrieving ranks from MongoDB");
    }
    return [];
  }

  public async registerUser(username: string, password: string, userData?: any) {
    const hash = bcrypt.hashSync(password, salt);
    const playerID = Player.generatePlayerID();
    // const key = this.getUserDatastoreKey(username);
    const playerIDkey = this.datastore.key([GCloudDataStore.Kinds.USERS, username, GCloudDataStore.Kinds.PLAYER_IDS, playerID]);
    const userKey = this.getUserDatastoreKey(username);
    const user: Database.User = {
      username,
      passwordHash: hash,
      statistics: {
        test: {
          nested: "abc"
        }
      },
      playerID: playerID,
      meta: {
        ...userData
      }
    }
    await this.datastore.insert({
      key: playerIDkey,
      data: {}
    })
    await this.datastore.insert({
      key: userKey,
      data: user,
      excludeFromIndexes: ['passwordHash']
    });
    console.log('saved');
  }

  private getUserDatastoreKey(username: string) {
    return this.datastore.key([GCloudDataStore.Kinds.USERS, username]);
  }

  private getMatchDatastoreKey(matchID: NanoID) {
    return this.datastore.key([GCloudDataStore.Kinds.MATCHES, matchID]);
  }

  /**
   * Gets user information. If public is false, will retrieve all information other than password
   * @param usernameOrID 
   */
  public async getUser(usernameOrID: string, publicView: boolean = true) {
    let user: Database.User | undefined;
    
    // query by playerID first, then by username
    const q = this.datastore.createQuery(GCloudDataStore.Kinds.USERS).filter('playerID', '=', usernameOrID);
    const res = await this.datastore.runQuery(q);
    user = res[0][0]; // there should only be one user with this playerID
    if (!user) { 
      const key = this.getUserDatastoreKey(usernameOrID);
      user = (await this.datastore.get(key))[0];
    }
    if (publicView && user) {
      delete user.passwordHash;
    }
    return user;
  } 

  public async loginUser(username: string, password: string) {
    return "JWT"
  }

  public async updateUser(usernameOrID: string, update: Partial<Database.User>) {
    let obj: Database.User = {
      username: 'dud',
      passwordHash: 'dud',
    }
    return obj;
  }

  public async deleteUser(usernameOrID: string) {
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
    return [];
  }

  public async manipulate(dimension: Dimension) {
    dimension.configs.backingDatabase = this.name;
    return;
  }

  public async storeTournamentConfigs(tournamentID: NanoID, tournamentConfigs: Tournament.TournamentConfigsBase, status: Tournament.Status) {
    // return this.models.tournamentConfigs.updateOne({ id: tournamentID }, { configs: tournamentConfigs, id: tournamentID, status: status, modificationDate: new Date()}, { upsert: true });
  }

  public async getTournamentConfigsModificationDate(tournamentID: NanoID) {
    // return this.models.tournamentConfigs.findOne({ id: tournamentID }).select({ modificationDate: 1 }).then((date) => {
    //   if (date) {
    //     return new Date(date.toObject().modificationDate);
    //   }
    //   else {
    //     return null;
    //   }
      
    // });
    return null;
  }
  public async getTournamentConfigs(tournamentID: NanoID) {
    // return this.models.tournamentConfigs.findOne({ id: tournamentID }).then((data) => {
    //   if (data) {
    //     return data.toObject();
    //   }
    //   else {
    //     return null;
    //   }
    // });
    return null;
  }
}
export module GCloudDataStore {
  /**
   * Configurations for Google Cloud Datastore
   */
  export interface Configs {
    /**
     * Keyfile to use for authentication
     */
    keyFile: string
  }

  /**
   * The kind of various groupings in the datastore
   */
  export enum Kinds {
    /**
     * For all user data
     */
    USERS = 'users',
    /**
     * Player ID data for uniqueness
     */
    PLAYER_IDS = 'playerIds',
    /**
     * For all tournament configuration data
     */
    TOURNAMENT_CONFIGS = 'tournamentConfigs',
    /**
     * For all match data
     */
    MATCHES = 'matches',
  }
}