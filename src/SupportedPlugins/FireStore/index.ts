import admin from 'firebase-admin';

import { Plugin } from '../../Plugin';
import { Database } from '../../Plugin/Database';
import { Dimension, DatabaseType, NanoID } from '../../Dimension';
import { Match } from '../../Match';
import { DeepPartial } from '../../utils/DeepPartial';
import { pickMatch } from '../../Station/routes/api/dimensions/match';
import bcrypt from 'bcryptjs';

import { generateToken, verify } from '../../Plugin/Database/utils';
import { Tournament } from '../../Tournament';
import { nanoid } from '../..';
import { TournamentStatus } from '../../Tournament/TournamentStatus';
import { deepMerge } from '../../utils/DeepMerge';
import { deepCopy } from '../../utils/DeepCopy';
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
const salt = bcrypt.genSaltSync();

type TournamentConfigsCollectionData = {
  status: Tournament.Status;
  configs: Tournament.TournamentConfigsBase;
  modificationDate: Date;
};

type MatchCollectionData = Pick<
  Match,
  | 'configs'
  | 'creationDate'
  | 'id'
  | 'log'
  | 'mapAgentIDtoTournamentID'
  | 'matchStatus'
  | 'name'
  | 'finishDate'
  | 'results'
  | 'replayFileKey'
  | 'replayFile'
> & { governID: string };

export class FireStore extends Database {
  public name = 'FireStore';
  public type = Plugin.Type.DATABASE;
  public db: FirebaseFirestore.Firestore;

  public userCollection: FirebaseFirestore.CollectionReference<Database.User>;
  public matchesCollection: FirebaseFirestore.CollectionReference<
    MatchCollectionData
  >;
  public tournamentConfigsCollection: FirebaseFirestore.CollectionReference<
    TournamentConfigsCollectionData
  >;

  constructor(
    fireStoreConfigs: FireStore.Configs,
    configs: DeepPartial<Database.Configs> = {}
  ) {
    super(configs);
    admin.initializeApp({
      credential: admin.credential.cert(fireStoreConfigs.keyFile),
    });
  }

  /**
   * Connects to the firestore database and returns the db object
   */
  public async connect(): Promise<FirebaseFirestore.Firestore> {
    this.db = admin.firestore();
    return this.db;
  }

  public async initialize(): Promise<void> {
    await this.connect();
    // create admin user
    const existingUser = await this.getUser('admin');
    if (!existingUser) {
      await this.registerUser('admin', process.env.ADMIN_PASSWORD);
    }
    this.userCollection = <
      FirebaseFirestore.CollectionReference<Database.User>
    >this.db.collection(FireStore.Collections.USERS);
    this.matchesCollection = <
      FirebaseFirestore.CollectionReference<MatchCollectionData>
    >this.db.collection(FireStore.Collections.MATCHES);
    this.tournamentConfigsCollection = <
      FirebaseFirestore.CollectionReference<TournamentConfigsCollectionData>
    >this.db.collection(FireStore.Collections.TOURNAMENT_CONFIGS);
    return;
  }

  public async storeMatch(match: Match, governID: nanoid): Promise<any> {
    const data = { ...pickMatch(match), governID: governID };
    // store all relevant data
    return this.matchesCollection.doc().set(data);
  }
  public async getMatch(id: NanoID): Promise<any> {
    const snapshot = await this.matchesCollection
      .where('matchID', '==', id)
      .get();
    return snapshot.docs[0].data();
  }

  public async getPlayerMatches(
    playerID: nanoid,
    governID: nanoid,
    offset = 0,
    limit = 10,
    order = -1
  ): Promise<Array<Match>> {
    let sortOrder: FirebaseFirestore.OrderByDirection = 'desc';
    if (order > 0) {
      sortOrder = 'asc';
    }
    let query = this.matchesCollection
      .where('governID', '==', governID)
      .orderBy('creationDate', sortOrder)
      .offset(offset);
    if (limit == 0) {
      return [];
    }
    if (limit > 0) {
      query = query.limit(limit);
    }
    const snapshot = await query.get();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return snapshot.docs.map((d) => d.data());
  }

  public async registerUser(
    username: string,
    password: string,
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    userData?: any
  ): Promise<any> {
    const hash = bcrypt.hashSync(password, salt);
    return this.userCollection.doc(username).set({
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
    const doc = await this.getUserDoc(usernameOrID);
    if (doc === null) {
      return null;
    }
    const user = doc.data();
    if (user && publicView) {
      user.passwordHash = '';
    }
    return user;
  }

  private async getUserDoc(usernameOrID: string) {
    let snapshot = await this.userCollection
      .where('playerID', '==', usernameOrID)
      .get();
    if (snapshot.empty) {
      snapshot = await this.userCollection
        .where('username', '==', usernameOrID)
        .get();
    }
    if (snapshot.empty) {
      return null;
    }
    return snapshot.docs[0];
  }

  public async loginUser(username: string, password: string): Promise<string> {
    const snapshot = await this.userCollection
      .where('username', '==', username)
      .get();
    if (snapshot.empty) {
      throw new Error('Not a valid user');
    }
    const user = snapshot.docs[0].data();
    if (bcrypt.compareSync(password, user.passwordHash)) {
      return generateToken(user);
    } else {
      throw new Error('Invalid password');
    }
  }

  public async updateUser(
    usernameOrID: string,
    update: Partial<Database.User>
  ): Promise<Database.User> {
    const doc = await this.getUserDoc(usernameOrID);
    if (doc === null) {
      throw new Error('Not a valid user');
    }
    await doc.ref.update(update);
    return deepMerge(deepCopy(doc.data()), deepCopy(update));
  }

  public async deleteUser(usernameOrID: string): Promise<void> {
    const doc = await this.getUserDoc(usernameOrID);
    await doc.ref.delete();
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
    if (limit == 0) {
      return [];
    }
    let query = this.userCollection
      .where(`${key}.matchesPlayed`, '>=', 0)
      .offset(offset);
    if (limit > 0) {
      query = query.limit(limit);
    }
    const snapshot = await query.get();
    return snapshot.docs.map((d) => d.data());
  }

  public async manipulate(dimension: Dimension): Promise<void> {
    dimension.configs.backingDatabase = DatabaseType.FIRESTORE;
    return;
  }

  public async storeTournamentConfigs(
    tournamentID: nanoid,
    tournamentConfigs: Tournament.TournamentConfigsBase,
    status: TournamentStatus
  ): Promise<void> {
    await this.tournamentConfigsCollection.doc(tournamentID).set({
      status: status,
      configs: tournamentConfigs,
      modificationDate: new Date(),
    });
    return;
  }

  public async getTournamentConfigsModificationDate(
    tournamentID: nanoid
  ): Promise<Date> {
    const snapshot = await this.tournamentConfigsCollection
      .doc(tournamentID)
      .get();
    return snapshot.data().modificationDate;
  }
  public async getTournamentConfigs(
    tournamentID: nanoid
  ): Promise<{
    configs: Tournament.TournamentConfigsBase;
    status: Tournament.Status;
  }> {
    const snapshot = await this.tournamentConfigsCollection
      .doc(tournamentID)
      .get();
    return snapshot.data();
  }
}
export namespace FireStore {
  export interface Configs {
    /** Key file used for authentication */
    keyFile: string;
  }
  export enum Collections {
    MATCHES = 'd_matches',
    USERS = 'd_users',
    TOURNAMENT_CONFIGS = 'd_tourney_configs',
  }
}
