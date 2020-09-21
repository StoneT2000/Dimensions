import { create } from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from 'sinon-chai';
import 'mocha';
import { Logger, MongoDB, Tournament } from '../../../src';
import { createLadderTourney, createLadderELOTourney } from '../tourney/utils';
import { Ladder } from '../../../src/Tournament/Ladder';
import { RankSystem } from '../../../src/Tournament/RankSystem';
const expect = chai.expect;
chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset);

const paper = { file: './tests/kits/js/normal/paper.js', name: 'paper' };
const rock = { file: './tests/kits/js/normal/rock.js', name: 'rock' };
const disabled = {
  file: './tests/kits/js/normal/rock.js',
  name: 'disabled',
  existingID: 'disabled',
};

const users = {
  // in seed, rock1 has stats in tourneys already
  rock1: {
    file: './tests/kits/js/normal/rock.js',
    name: 'rock1',
    existingID: 'rock1',
  },
  rock2: {
    file: './tests/kits/js/normal/rock.js',
    name: 'rock2',
    existingID: 'rock2',
  },
  rock3: {
    file: './tests/kits/js/normal/rock.js',
    name: 'rock3',
    existingID: 'rock3',
  },
};

const paperBot = {
  file: './tests/kits/js/normal/paper.js',
  name: 'paperbot',
  existingID: 'paperbot',
};
const botList = [rock, paper];
const userBotList = [disabled, users.rock2, paperBot]; // new bots to add

describe('Testing Database with Tournament Singletons (no distribution)', () => {
  const rpsDesign = new RockPaperScissorsDesign('RPS');
  const d = create(rpsDesign, {
    activateStation: false,
    observe: false,
    id: '12345678',
    loggingLevel: Logger.LEVEL.NONE,
    defaultMatchConfigs: {
      bestOf: 5,
      storeErrorLogs: false,
    },
  });
  const mongo = new MongoDB(
    'mongodb://root:rootpassword@localhost:27017/test?authSource=admin&readPreference=primary'
  );
  // let datastore = new GCloudDataStore({
  //   keyFile: "./tests/keys/owneraccess.json"
  // });
  before(async () => {
    await d.use(mongo);
    // await d.use(datastore);
  });

  describe('Test running', () => {
    it('should run', async () => {
      // eslint-disable-next-line no-async-promise-executor
      return new Promise(async (resolve, reject) => {
        // note, each tourney needs to be of a different id or else we lose track of one and can't clean up
        const tourney = createLadderTourney(d, botList, {
          name: 'Ladder Tournament',
          id: '123456ts',
          tournamentConfigs: {
            syncConfigs: false,
          },
        });
        await tourney.run();
        let count = 0;
        tourney.on(Tournament.Events.MATCH_HANDLED, async () => {
          if (++count > 4) {
            try {
              const ranks = await tourney.getRankings();
              expect(tourney.state.statistics.totalMatches).to.be.greaterThan(
                1
              );
              expect(ranks[0].player.file).to.equal(paper.file);
              expect(ranks[1].player.file).to.equal(rock.file);
              // expect all players to be anonymous players as db is used, but no ids given
              expect(tourney.anonymousCompetitors.size).to.equal(2);
              await tourney.destroy();
              resolve();
            } catch (err) {
              await tourney.destroy();
              reject(err);
            }
          }
        });
      });
    });
    it('should run elo', async () => {
      // eslint-disable-next-line no-async-promise-executor
      return new Promise(async (resolve, reject) => {
        // note, each tourney needs to be of a different id or else we lose track of one and can't clean up
        const tourney = createLadderELOTourney(d, botList, {
          name: 'Ladder Tournament',
          id: '123456elo',
          tournamentConfigs: {
            syncConfigs: false,
          },
        });
        await tourney.run();
        let count = 0;
        tourney.on(Tournament.Events.MATCH_HANDLED, async () => {
          if (++count > 4) {
            try {
              const ranks = await tourney.getRankings();
              expect(tourney.state.statistics.totalMatches).to.be.greaterThan(
                4,
                'run more than 4 matches'
              );
              expect(ranks[0].player.file).to.equal(
                paper.file,
                'paper is first place'
              );
              expect(ranks[1].player.file).to.equal(
                rock.file,
                'rock is second place'
              );
              expect(tourney.anonymousCompetitors.size).to.equal(
                2,
                'both bots in tourney should be anonymous competitors'
              );
              await tourney.destroy();
              resolve();
            } catch (err) {
              await tourney.destroy();
              reject(err);
            }
          }
        });
      });
    });
    describe('Test on Trueskill', () => {
      let t: Ladder;
      before(() => {
        t = createLadderTourney(d, userBotList, {
          name: 'Ladder Tournament',
          id: '12345ts',
          tournamentConfigs: {
            syncConfigs: false,
            selfMatchMake: false,
          },
          loggingLevel: Logger.LEVEL.ERROR,
          rankSystemConfigs: {
            initialMu: 25,
          },
        });
      });
      after(async () => {
        await t.destroy();
      });
      it('should run with users and store user data + match data', async () => {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
          await t.run();
          t.scheduleMatches(
            [paperBot.existingID, disabled.existingID],
            [paperBot.existingID, users.rock2.existingID],
            [paperBot.existingID, users.rock1.existingID]
          );
          let count = 0;
          t.on(Tournament.Events.MATCH_HANDLED, async () => {
            if (++count > 2) {
              try {
                await t.stop();
                const ranks = await t.getRankings();

                expect(t.state.statistics.totalMatches).to.be.greaterThan(
                  2,
                  'run more than 2 matches'
                );
                expect(ranks[0].player.tournamentID.id).to.equal(
                  paperBot.existingID,
                  'paper bot should be first'
                );
                const { user } = await t.getPlayerStat(paperBot.existingID);

                // check database stored value is same
                expect(
                  user.statistics[t.getKeyName()].rankState.rating.mu
                ).to.approximately(
                  ranks[0].rankState.rating.mu,
                  0.01,
                  'user rank mu should match what was returned from getRankings'
                );
                // there shouldn't be any anon competitors if all are using ids
                expect(t.anonymousCompetitors.size).to.equal(
                  0,
                  'no competitor should be anonymous if ids are provided'
                );
                resolve();
              } catch (err) {
                reject(err);
              }
            }
          });
        });
      });

      it('should reset rankings', async () => {
        await t.resetRankings();
        const { playerStat } = await t.getPlayerStat(paperBot.existingID);
        const rankState: RankSystem.TrueSkill.RankState = (<
          Tournament.Ladder.PlayerStat
        >playerStat).rankState;
        expect(rankState.rating.mu).to.equal(
          t.configs.rankSystemConfigs.initialMu,
          'reset ranking to initialMu'
        );
      });
      it('should allow new bots and bot updates that update bot stats and versions', async () => {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
          await t.resume();
          t.scheduleMatches(
            [paperBot.existingID, disabled.existingID],
            [paperBot.existingID, users.rock2.existingID]
          );
          let count = 0;
          t.on(Tournament.Events.MATCH_HANDLED, async () => {
            if (++count > 1) {
              try {
                let { playerStat } = await t.getPlayerStat(paperBot.existingID);
                const paperbotMatchCount = playerStat.matchesPlayed;
                await t.addplayer(paperBot);
                playerStat = (await t.getPlayerStat(paperBot.existingID))
                  .playerStat;
                expect(playerStat.matchesPlayed).to.be.lessThan(
                  paperbotMatchCount,
                  'updated bot should reset stats and matches played should be less than before'
                );
                expect(
                  (await t.getPlayerStat(paperBot.existingID)).playerStat.player
                    .version
                ).to.equal(
                  1,
                  'player (paper bot) version number should update'
                );

                await t.addplayer(users.rock3);
                playerStat = (await t.getPlayerStat(users.rock3.existingID))
                  .playerStat;
                expect(playerStat).to.be.not.equal(null, 'new bot exists');
                expect(
                  (await t.getPlayerStat(users.rock3.existingID)).playerStat
                    .player.version
                ).to.equal(0, 'player version number should initialize with 0');
                resolve();
              } catch (err) {
                reject(err);
              }
            }
          });
        });
      });
    });

    describe('Test on ELO', () => {
      let t: Ladder;
      before(() => {
        t = createLadderELOTourney(d, userBotList, {
          name: 'Ladder Tournament',
          id: '12345elo',
          tournamentConfigs: {
            syncConfigs: false,
            selfMatchMake: false,
          },
          rankSystemConfigs: {
            startingScore: 1000,
          },
        });
      });
      after(async () => {
        await t.destroy();
      });
      it('should run with users and store user data + match data', async () => {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
          await t.run();
          t.scheduleMatches(
            [paperBot.existingID, disabled.existingID],
            [paperBot.existingID, users.rock2.existingID],
            [paperBot.existingID, users.rock1.existingID]
          );
          let count = 0;
          t.on(Tournament.Events.MATCH_HANDLED, async () => {
            if (++count > 2) {
              try {
                await t.stop();
                const ranks = await t.getRankings();
                expect(t.state.statistics.totalMatches).to.be.greaterThan(
                  2,
                  'run more than 2 matches'
                );
                expect(ranks[0].player.tournamentID.id).to.equal(
                  paperBot.existingID,
                  'first place should be paper bot'
                );
                const { user } = await t.getPlayerStat(paperBot.existingID);
                // check database stored value is same
                expect(
                  user.statistics[t.getKeyName()].rankState.rating.score
                ).to.equal(
                  ranks[0].rankState.rating.score,
                  'user stored score should be same returned from getRankings'
                );
                // there shouldn't be any anon competitors if all are using ids
                expect(t.anonymousCompetitors.size).to.equal(
                  0,
                  'should be no anonymous competitors'
                );
                resolve();
              } catch (err) {
                reject(err);
              }
            }
          });
        });
      });

      it('should reset rankings', async () => {
        await t.resetRankings();
        const { playerStat } = await t.getPlayerStat(paperBot.existingID);
        const rankState: RankSystem.ELO.RankState = (<
          Tournament.Ladder.PlayerStat
        >playerStat).rankState;
        expect(rankState.rating.score).to.equal(
          t.configs.rankSystemConfigs.startingScore,
          'elo score should reset to startingScore when tournament does not do a hard stop'
        );
      });
      it('should allow new bots and bot updates that update bot stats and versions', async () => {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
          await t.resume();
          t.scheduleMatches(
            [paperBot.existingID, disabled.existingID],
            [paperBot.existingID, users.rock2.existingID]
          );
          let count = 0;
          t.on(Tournament.Events.MATCH_HANDLED, async () => {
            if (++count > 1) {
              try {
                let { playerStat } = await t.getPlayerStat(paperBot.existingID);
                const paperbotMatchCount = playerStat.matchesPlayed;
                // addplayer to update the bot
                await t.addplayer(paperBot);
                playerStat = (await t.getPlayerStat(paperBot.existingID))
                  .playerStat;
                expect(playerStat.matchesPlayed).to.be.lessThan(
                  paperbotMatchCount,
                  'updated bot should reset stats and matches played should be less than before'
                );
                expect(
                  (await t.getPlayerStat(paperBot.existingID)).playerStat.player
                    .version
                ).to.equal(
                  1,
                  'player (paper bot) version number should update'
                );

                // addplayer to add new bot
                await t.addplayer(users.rock3);
                playerStat = (await t.getPlayerStat(users.rock3.existingID))
                  .playerStat;
                expect(playerStat).to.be.not.equal(null, 'new bot exists');
                expect(
                  (await t.getPlayerStat(users.rock3.existingID)).playerStat
                    .player.version
                ).to.equal(0, 'player version number should initialize with 0');
                resolve();
              } catch (err) {
                reject(err);
              }
            }
          });
        });
      });
    });
  });

  after(async () => {
    await d.cleanup();
    await mongo.db.close();
  });
});
