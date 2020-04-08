import * as Dimension from '../src';
import { DominationDesign } from './domination';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from "sinon";
import sinonChai from "sinon-chai";
import 'mocha';
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiAsPromised);


describe('Testing with Domination Game', () => {
  let dominationDesign, myDimension;
  before(() => {
    dominationDesign = new DominationDesign('Domination');
    myDimension = Dimension.create(dominationDesign, {
      name: 'Domination',
      loggingLevel: Dimension.Logger.LEVEL.NONE,
      observe: false,
      activateStation: false
    });
  });
  it('Test Run A match of Domination', async () => {
    // expect.assertions(2);

    let jsSource = "./tests/js-kit/domination/random.js";
    let botSources = [];

    // sets up a deterministic game where all bots will end up expanding down
    for (let i = 0; i < 4; i++) {
      botSources.push(jsSource);
    }
    let expectedResultMap = [ [ 0, 1, 2, 3 ], [ 0, 1, 2, 3 ], [ 0, 1, 2, 3 ], [ 0, 1, 2, 3 ] ];
    let expectedScore = 4; 

    let results: any = await myDimension.runMatch(
      botSources,
      {
        name: 'test-domination-match',
        initializeConfig:{
          
          size: 4,
          maxRounds: 5
        },
        loggingLevel: Dimension.Logger.LEVEL.WARN,
      }
    );
    expect(results.finalMap).to.be.eql(expectedResultMap)
    expect(results.winningScore).to.equal(expectedScore);
  });
  it('Validate contents of objects', async () => {
    expect(myDimension.design.name).to.equal('Domination');
    expect(myDimension.log).to.be.instanceOf(Dimension.Logger);
  })
  describe('Receive MatchErrors and FatalErrors from a match of Domination', () => {
  
    it('Match Errors', async () => {
      let jsSource = "./tests/js-kit/domination/errorProvokingBot.js";
      let botSources = [];

      // sets up a deterministic game where all bots will end up expanding down
      for (let i = 0; i < 3; i++) {
        botSources.push(jsSource);
      }
      botSources.push("./tests/js-kit/domination/deterministic.js")
      let expectedResultMap = [ [ 0, 1, 2, 3 ], [ -1, -1, -1, 3 ], [ -1, -1, -1, -1 ], [ -1, -1, -1, -1 ] ];
      let expectedScore = 2; 

      
      let match: any = await myDimension.createMatch(
        botSources,
        {
          name: 'test-domination-match-matcherrors',
          initializeConfig:{
            
            size: 4,
            maxRounds: 2
          },
          loggingLevel: Dimension.Logger.LEVEL.WARN
        }
      );

      let status: Dimension.MatchStatus;
      
      
      // Store results
      let results = await match.run();

      expect(results.finalMap).to.eql(expectedResultMap)
      expect(results.winningScore).to.eql(expectedScore);

      // expect(matchEngineLogSpy).to.equal(3);
    });

    it('Fatal Errors', async () => {
      let botSources = [];
      for (let i = 0; i < 3; i++) {
        botSources.push('./tests/js-kit/domination/deterministic.js');
      }
      botSources.push('./tests/js-kit/domination/fakefile.js');

      // Throw invalid file errors
      expect(myDimension.createMatch(
        botSources,
        {
          name: 'test-domination-match-fatalerrors',
          initializeConfig:{
            size: 4,
            maxRounds: 5
          }
        }
      )).to.be.rejectedWith('Dimension.FatalError: No files provided for match');

      // Throw missing file error
      expect(myDimension.createMatch(
        [],
        {
          name: 'test-domination-match-fatalerrors',
          initializeConfig:{
            size: 4,
            maxRounds: 5
          }
        }
      )).to.be.rejectedWith('Dimension.FatalError: ./tests/js-kit/domination/fakefile.js does not exist, check if file path provided is correct');
    });
  });

  describe('Test Create Match and Validate its contents', () => {
  
    it('Validate Agents', async () => {
      const agentCount = 4;
    let match: Dimension.Match;
      let jsSource = "./tests/js-kit/domination/deterministic.js";
      let botSources = [];

      // sets up a deterministic game where all bots will end up expanding down
      for (let i = 0; i < agentCount; i++) {
        botSources.push({file:jsSource, name:'bob ' + i});
      }
      match = await myDimension.createMatch(
        botSources,
        {
          name: 'test-domination-match-validate-props',
          initializeConfig:{
            size: agentCount,
            maxRounds: agentCount + 1
          },
          loggingLevel: Dimension.Logger.LEVEL.NONE
        }
      );
      expect(match.agents.length).to.equal(agentCount);
      expect(match.agentFiles.length).to.equal(agentCount);
      for (let i = 0; i < match.agentFiles.length; i++) {
        let agent = match.agents[i];
        expect(agent.cmd).to.equal('node'); // ensure right command was passed
        expect(agent.name).to.equal('bob ' + i); // ensure naming worked
        expect(agent.process).not.to.equal(null); // ensure processes were made
        expect(agent.process.killed).to.equal(false); // ensure processes are alive after initiation
      }
      match.run();
    });
  });
});