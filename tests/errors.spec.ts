import {create, FatalError, Design, DimensionType, Logger, Agent} from '../src';
import { DominationDesign } from './domination';
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
      expect(shouldThrow).to.throw(FatalError);
    });
    it('should throw fatal if unrecognizeed file provided for agent to spawn', () => {
      let agent = new Agent('./tests/testingfiles/fakebot.fakeext', {name: 'fake', id: 'fake-0'});
      expect(agent._spawn()).to.be.rejectedWith(FatalError, 'Unrecognized file');
    });
    it('show throw fatal if no files given to static agent generator', () => {
      let shouldThrow = () => {
        Agent.generateAgents([], Logger.LEVEL.ALL)
      };
      expect(shouldThrow).to.throw(FatalError);
    });
  });

  describe('Errors from dimension class', () => {
    it('should throw fatal if no files provided to runMatch', () => {
      expect(myDimension.runMatch([])).to.be.rejectedWith(FatalError);
    });
  });


});