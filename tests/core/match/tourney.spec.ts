import * as Dimension from '../../../src';
let MatchStatus = Dimension.Match.Status;
import { RockPaperScissorsDesign } from '../../rps';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { Tournament, Logger, DError, Player } from '../../../src';
import TournamentError = DError.TournamentError;
import { DeepPartial } from '../../../src/utils/DeepPartial';

chai.use(chaiAsPromised);
const expect = chai.expect;

const testTournamentStopResume = async (t: Tournament, done: Function) => {
  let res = t.run();
  
  setTimeout(() => {
    expect(t.resume()).to.eventually.be.rejectedWith(TournamentError);
    expect(t.status).to.equal(Dimension.Tournament.TournamentStatus.RUNNING);
    t.stop();
    
  }, 100);
  const testResume = async () => {
    expect(t.stop()).to.eventually.be.rejectedWith(TournamentError);
    expect(t.status).to.equal(Dimension.Tournament.TournamentStatus.STOPPED);
    await t.resume();
    expect(t.status).to.equal(Dimension.Tournament.TournamentStatus.RUNNING);
    t.destroy();
    done();
  }
  setTimeout(() => {
    testResume();
  }, 1500);

}

describe('Tournament Testing with RPS', () => {
  let RPSDesign, RPSTournament: Dimension.Tournament.RoundRobin;
  let DefaultRPSTournament: Dimension.Tournament.RoundRobin;
  let myDimension: Dimension.DimensionType;
  
  let players = ['./tests/js-kit/rps/smarter.js', './tests/js-kit/rps/paper.js', './tests/js-kit/rps/errorBot.js', './tests/js-kit/rps/rock.js'];
  let names = ['smarter', 'paper', 'errorplayer', 'rock'];
  let filesAndNames = [];
  for (let i = 0; i < players.length; i++) {
    filesAndNames.push({file: players[i], name: names[i]});
  }

  describe('Elimination', () => {
    let EliminationTourney: Tournament;
    beforeEach(() => {
      myDimension = Dimension.create(RPSDesign, {
        name: 'RPS',
        activateStation: false,
        observe: false,
        loggingLevel: Dimension.Logger.LEVEL.ERROR
      });
      EliminationTourney = myDimension.createTournament(filesAndNames, {
        type: Dimension.Tournament.Type.ELIMINATION,
        rankSystem: Dimension.Tournament.RankSystem.WINS,
        name: 'Rock Paper Scissors Elim Tourney',
        loggingLevel: Dimension.Logger.LEVEL.NONE,
        agentsPerMatch: [2],
        consoleDisplay: false,
        defaultMatchConfigs: {
          bestOf: 9,
          loggingLevel: Dimension.Logger.LEVEL.NONE
        },
        resultHandler: RockPaperScissorsDesign.winsResultHandler
      });
    });
    describe('Running Tournament', async () => {
      it('should run a tourney and output appropriate results', async () => {
        let res = <Tournament.Elimination.State>(await EliminationTourney.run());
        let smarterPlayer: Player;
        EliminationTourney.competitors.forEach((player) => {
          if (player.tournamentID.name === 'smarter') {
            smarterPlayer = player;
          }
        })
        expect(res.playerStats.get(smarterPlayer.tournamentID.id).rank).to.equal(1);
      });
      it('should stop and resume', (done) => {
        testTournamentStopResume(EliminationTourney, done);
      });
    });
  });
  after(() => {
    myDimension.cleanup();
  })

});