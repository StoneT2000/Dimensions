import {create, FatalError, Design, DimensionType, Logger, Agent, DError} from '../../../src';
import { DominationDesign } from '../../domination';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from "sinon-chai";
import 'mocha';
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiAsPromised);


describe('Testing Errors', () => {
  let dominationDesign: Design, myDimension: DimensionType;
  before(() => {
    dominationDesign = new DominationDesign('Domination');
    myDimension = create(dominationDesign, {
      name: 'Domination',
      loggingLevel: Logger.LEVEL.NONE,
      observe: false,
      activateStation: false
    });
  });
  describe('Errors from agent class', () => {
    it('should throw fatal if no id provided for agent', () => {
      let shouldThrow = () => {
        new Agent('./tests/rps.js', {});
      }
      return expect(shouldThrow).to.throw(DError.AgentMissingIDError);
    });
    it('should throw fatal if unrecognizeed file provided for agent to spawn', () => {
      let agent = new Agent('./tests/testingfiles/fakebot.fakeext', {name: 'fake', id: 2});
      return expect(agent._spawn()).to.be
      .rejectedWith(DError.NotSupportedError, 'Language with extension .fakeext is not supported yet');
    });
    it('show throw fatal if no files given to static agent generator', () => {
      let shouldThrow = () => {
        Agent.generateAgents([], {})
      };
      return expect(shouldThrow).to.throw(DError.AgentFileError);
    });
  });

  describe('Errors from dimension class', () => {
    it('should throw fatal if no files provided to runMatch', () => {
      return expect(myDimension.runMatch([])).to.be.rejectedWith(DError.MissingFilesError);
    });
  });


});