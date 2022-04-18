import { Dimension } from '..';
import { Environment } from '../Environment';
import { Episode, MultiAgentEpisodeResult } from '../Episode';
import { Logger } from '../Logger';
import { genID, NanoID } from '../utils';
import { deepMerge } from '../utils/DeepMerge';
import { DeepPartial } from '../utils/DeepPartial';
import { RankSystem } from './RankSystem';
import { Scheduler } from './Scheduler';
import { TournamentStatus, TournamentConfigs } from './types';
import { Mutex, MutexInterface, Semaphore } from 'async-mutex';
import { MatchDestroyedError } from '../DimensionError';
import { Agent } from '../Agent';

export type extractRankState<R> = R extends RankSystem<any, infer T>
  ? T
  : never;

export class Player {
  public name: string;
  public id: string;
  /** Whether this player and agent is still usable and active for competition */
  public active: boolean;
  constructor(public agent: string) {}
}
export interface PlayerStat<RankSystemType> {
  player: Player;
  rankState: extractRankState<RankSystemType>;
}
export type QueuedEpisode = {
  playerID: string; // more of a tournament ID
  agent: string;
}[];
export class Tournament<
  RankSystemType extends RankSystem<any, any>
  // RankSystemConfigs,
  // RankState
> {
  /** Mapping episode ids to active ongoing episodes */
  public activeEpisodes: Map<NanoID, Episode> = new Map();

  /** The current status of the tournament */
  public status: TournamentStatus = TournamentStatus.UNINITIALIZED;

  /** A queue whose elements are each arrays of players that are to compete against each other */
  public episodeQueue: Array<QueuedEpisode> = [];

  /** Registered agents in this tournament */
  public competitors: Map<NanoID, PlayerStat<RankSystemType>> = new Map();
  private competitorsMutexes: Map<NanoID, Mutex> = new Map();

  /** This tournament's ID */
  public id: NanoID;

  public configs: TournamentConfigs = {
    concurrent: 1,
    name: null,
    teamsPerMatch: [2],
  };
  public rankSystem: RankSystemType;

  public log: Logger = new Logger();

  /** All initialized environments */
  public envAllocatedPool: Record<string, Map<string, Environment>> = {};
  /** All environments that aren't currently running an episode */
  public envAvailablePool: Record<string, Map<string, Environment>> = {};
  public envAvailablePoolSemaphore: Semaphore;
  public envAvailablePoolMutex: Mutex = new Mutex();

  public scheduler: Scheduler;

  constructor(
    public environment: string,
    public dim: Dimension,
    rankSystem: RankSystemType,
    scheduler: Scheduler,
    configs: DeepPartial<TournamentConfigs> = {}
  ) {
    this.configs = deepMerge(this.configs, configs);
    this.id = `tournament_${genID(12)}`;
    this.rankSystem = rankSystem;

    if (this.configs.name) {
      this.log.identifier = this.configs.name;
    } else {
      this.log.identifier = this.id;
    }
    this.log.info(
      `Created Tournament - ID: ${this.id}, Name: ${this.configs.name}`
    );
    this.scheduler = scheduler;
    this.status = TournamentStatus.INITIALIZED;
    this.envAvailablePool[environment] = new Map();
    this.envAllocatedPool[environment] = new Map();
    this.envAvailablePoolSemaphore = new Semaphore(this.configs.concurrent);
  }
  // async setup() {}
  //
  public async close(): Promise<void> {
    this.status = TournamentStatus.FINISHED;
    const closePromises: Promise<void>[] = [];
    this.envAllocatedPool[this.environment].forEach((env) => {
      closePromises.push(env.close());
    });
    await Promise.all(closePromises);
    return;
  }
  public runner: Promise<void>;
  public episodeQueueMutex: Mutex = new Mutex();
  async registerPlayer(agent: string): Promise<Player> {
    const player = new Player(agent);
    player.id = `player_${genID(12)}`;
    this.competitors.set(player.id, {
      player,
      rankState: this.rankSystem.initializeRankState(),
    });
    this.competitorsMutexes.set(player.id, new Mutex());
    return player;
  }
  async run(): Promise<void> {
    this._runner();
    this.status = TournamentStatus.RUNNING;
  }
  async pause(): Promise<void> {
    this.status = TournamentStatus.STOPPED;
  }
  private async _runner() {
    const release = await this.episodeQueueMutex.acquire();
    let matchesToRun = 0;
    if (this.configs.concurrent > this.activeEpisodes.size) {
      matchesToRun = this.configs.concurrent - matchesToRun;
    }

    const competitors = Array.from(this.competitors.values());
    competitors.sort((a, b) => {
      return this.rankSystem.rankComparator(a.rankState, b.rankState);
    });
    this.episodeQueue.push(
      ...this.scheduler.schedule(competitors, matchesToRun * 2)
    );
    const activeMatchPromises: Promise<void>[] = [];
    for (let i = 0; i < matchesToRun; i++) {
      const episode = this.episodeQueue.shift();
      const activeMatchPromise = this._run_episode(episode);
      activeMatchPromises.push(activeMatchPromise);
    }
    release();
    Promise.race(activeMatchPromises)
      .then(() => {
        if (this.status == TournamentStatus.RUNNING) {
          this._runner();
        }
      })
      .catch((err: Error) => {
        this.log.error(err);
        if (err instanceof MatchDestroyedError) {
          // keep running even if a match is destroyed and the tournament is marked as to keep running
          if (this.status == TournamentStatus.RUNNING) {
            this._runner();
          }
        } else {
          if (this.status == TournamentStatus.RUNNING) {
            this._runner();
          }
        }
      });
  }
  private async _run_episode(queuedEpisode: QueuedEpisode) {
    // take an available env out of pool, if no more, create a new env
    const pool = this.envAvailablePool[this.environment];
    const releaseMutex = await this.envAvailablePoolMutex.acquire();
    let env: Environment = null;
    // critical section start
    if (pool.size == 0) {
      env = await this.dim.makeEnv(this.environment, { max_cycles: 29 });
      // create new entry in pool for these environments
      if (!this.envAllocatedPool[this.environment]) {
        this.envAllocatedPool[this.environment] = new Map();
      }
      if (!this.envAvailablePool[this.environment]) {
        this.envAvailablePool[this.environment] = new Map();
      }
      this.envAllocatedPool[this.environment].set(env.id, env);
      this.envAvailablePool[this.environment].set(env.id, env);
    }
    const [_, release] = await this.envAvailablePoolSemaphore.acquire();

    env = pool.values().next().value;
    pool.delete(env.id);
    releaseMutex();
    // critical section end
    // eslint-disable-next-line prefer-const
    const runRet = await this.dim.runEpisode(
      env,
      queuedEpisode.map((v) => v.agent)
    );
    const results = runRet.results as MultiAgentEpisodeResult;
    const agents = runRet.agents;
    const agentPlayerIDs = queuedEpisode.map((v, i) => {
      const agentID = env.agentIDToPlayerID.get(agents[i].id);
      const playerID = v.playerID;
      return { agentID, playerID };
    });
    const releasesPromises: Promise<MutexInterface.Releaser>[] = [];
    agentPlayerIDs.forEach(({ playerID }) => {
      releasesPromises.push(this.competitorsMutexes.get(playerID).acquire());
    });
    const releases = await Promise.all(releasesPromises);
    const currentRankStates: extractRankState<RankSystemType>[] = [];
    const scores = [];
    agentPlayerIDs.forEach(({ agentID, playerID }) => {
      currentRankStates.push(this.competitors.get(playerID).rankState);
      scores.push(results.final.data[agentID].info.score);
    });
    // acquire all locks for competitors and their ranks, then update them
    const newRankStates = this.rankSystem.updateRanks(
      currentRankStates,
      scores
    );
    agentPlayerIDs.forEach(({ playerID }, i) => {
      const player = this.competitors.get(playerID).player;
      this.competitors.set(playerID, {
        player,
        rankState: newRankStates[i],
      });
      releases[i]();
    });
    pool.set(env.id, env);
    release();
  }
}
