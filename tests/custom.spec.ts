import * as Dimension from '../src';
import { Tournament, Logger } from '../src';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from "sinon-chai";
import 'mocha';
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiAsPromised);
let Match = Dimension.Match;
let pathtorunner = './tests/bh20files/run_game.sh'

let bh2020 = Dimension.Design.createCustom('bh2020trueskill', {
  resultHandler: (res) => {
    let results: Dimension.Tournament.RANK_SYSTEM.TRUESKILL.Results;
    if (res[0] === 'Team.WHITE wins!') {
      return {ranks: [{rank: 1, agentID: 0}, {rank: 2, agentID: 1}]};
    }
    else if (res[0] === 'Team.BLACK wins!') {
      return {ranks: [{rank: 2, agentID: 0}, {rank: 1, agentID: 1}]};
    }
    else {
      console.error(res);
      throw Error('Unexpected output!');
    }
  },
  command: pathtorunner,
  arguments: ['D_FILES', Math.floor(Math.random() * 1000).toString(), 'D_MATCH_ID', '16', '250']
});

let battlecodeDimension = Dimension.create(bh2020, {
  name: 'Battlecode Dimensions',
  loggingLevel: Dimension.Logger.LEVEL.NONE,
  observe: false,
  activateStation: false,
})

let pathToExampleFuncs = 'tests/bh20files/examplefuncsplayer'
let pathToEmptyBot = 'tests/bh20files/emptybot'

let botlist = [{file: pathToExampleFuncs, name: 'example_1'}, {file: pathToEmptyBot, name: 'empty_1'}];

let tourney = battlecodeDimension.createTournament(botlist, {
  type: Tournament.TOURNAMENT_TYPE.ROUND_ROBIN,
  name: 'The \'real\' Battle hack 2020 leaderboard',
  rankSystem: Tournament.RANK_SYSTEM.WINS,
  consoleDisplay: false,
  defaultMatchConfigs: {
    loggingLevel: Logger.LEVEL.NONE
  },
  resultHandler: (res) => {
    let results: Dimension.Tournament.RANK_SYSTEM.WINS.Results;
    if (res.ranks[0].rank === 1) {
      return {winners: [res.ranks[0].agentID], losers: [res.ranks[1].agentID], ties: []};
    }
    else if (res.ranks[0].rank === 2) {
      return {winners: [res.ranks[1].agentID], losers: [res.ranks[0].agentID], ties: []};
    }
    else {
      console.error('UNEXPECTED OUTPUT!!', res);
      return {winners: [], losers: [], ties: [0, 1]};
    }
  },
  agentsPerMatch: [2],
  tournamentConfigs: {
    // maxConcurrentMatches: 2,
    storePastResults: false
  }
});

describe('Testing with custom Battlehack2020 design', () => {
  describe('Test run match', () => {
    it('should run and example should beat empty and return appropriate results', () => {
      battlecodeDimension.runMatch([pathToExampleFuncs, pathToEmptyBot]).then((res) => {
        expect(res).to.eql({ranks: [{rank: 1, agentID: 0}, {rank: 2, agentID: 1}]});
      });
    });
    it('should run a tourney fine', async () => {
      let res = await tourney.run();
      expect(res.playerStats.get('t0_0')).to.contain({wins: 2, ties: 0, losses: 0, matchesPlayed: 2});
      expect(res.playerStats.get('t0_1')).to.contain({wins: 0, ties: 0, losses: 2, matchesPlayed: 2});
    });
  });
});