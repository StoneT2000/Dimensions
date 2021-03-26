import { create, DimensionType, Match, MatchWarn } from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from 'sinon-chai';
import 'mocha';
import { Logger } from '../../../src';
const expect = chai.expect;
chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset);

describe('Testing Match Detached Mode', () => {
  const rpsDesign = new RockPaperScissorsDesign('RPS');
  const d = create(rpsDesign, {
    activateStation: false,
    observe: false,
    id: '12345678',
    loggingLevel: Logger.LEVEL.NONE,
    defaultMatchConfigs: {
      bestOf: 9,
      storeErrorLogs: false,
    },
  });

  it("should run", async () => {
    const match = await d.createMatch([{
      file: "blank",
      name: "bot1"
    }, {
      file: "blank",
      name: "bot2"
    }], {
      detached: true,
      agentOptions: {detached: true},
      bestOf: 9,
    });
    for (let i = 0; i < 9; i++) {
      await match.step([{agentID: 0, command: "R"}, {agentID: 1, command: "S"}])
    }
    const results = await match.getResults();
    expect(results.scores).to.eql({ '0': 9, '1': 0 });
  });

  it("should return match status when calling match.step()", async () => {
    const match = await d.createMatch([{
      file: "blank",
      name: "bot1"
    }, {
      file: "blank",
      name: "bot2"
    }], {
      detached: true,
      agentOptions: {detached: true},
      bestOf: 9,
    });
    for (let i = 0; i < 9; i++) {
      const status = await match.step([{agentID: 0, command: "R"}, {agentID: 1, command: "S"}]);
      if (i < 8) {
        expect(status).to.equal(Match.Status.RUNNING);
      } else {
        expect(status).to.equal(Match.Status.FINISHED);
      }
    }
    
  });

  it("should keep track of agent messages written to it", async () => {
    const match = await d.createMatch([{
      file: "blank",
      name: "bot1"
    }, {
      file: "blank",
      name: "bot2"
    }], {
      detached: true,
      agentOptions: {detached: true},
      bestOf: 9,
    });

    // verify initialization messages
    match.agents.forEach((agent) => {
      expect(agent.messages[0]).to.equal(`${agent.id}`);
      expect(agent.messages[1]).to.equal(`${match.configs.bestOf}`);
      agent.messages = [];
    });
    for (let i = 0; i < 9; i++) {
      let choices = ["R", "S"]
      await match.step([{agentID: 0, command: choices[0]}, {agentID: 1, command: choices[1]}]);
      

      match.agents.forEach((agent, i) => {
        // rps design sends id of winning agent and then the move the other agent sent
        expect(agent.messages[0]).to.equal("0");
        expect(agent.messages[1]).to.equal(choices[(i + 1) % 2]);
        
        // clear messages
        agent.messages = [];
      });
    }
    
  });

  after(() => {
    d.cleanupMatches();
  });
});
