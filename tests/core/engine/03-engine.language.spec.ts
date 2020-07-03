import * as Dimension from '../../../src';
import { RockPaperScissorsDesign } from '../../rps';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import sinonChai from "sinon-chai";
import sinon from "sinon";
import 'mocha';
import { Logger, Match, MatchEngine, Agent } from '../../../src';
import { fail } from 'assert';
const expect = chai.expect;
chai.should()
chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiSubset);

describe('Testing MatchEngine Multi Language Support', () => {
  let d: Dimension.DimensionType;
  let rpsDesign = new RockPaperScissorsDesign('RPS');
  before( async () => {
    d = Dimension.create(rpsDesign, {
      activateStation: false,
      observe: false,
      loggingLevel: Logger.LEVEL.NONE
    });
  });
  
  describe("Test python", () => {
    it("should run", async () => {
      fail();
    });
  });

  describe("Test typescript", () => {
    it("should run", async () => {
      fail();
    });
  });

  describe("Test java", () => {
    it("should run", async () => {
      fail();
    });
  });

  describe("Test c++", () => {
    it("should run", async () => {
      fail();
    });
  });

  describe("Test c", () => {
    it("should run", async () => {
      fail();
    });
  });

  describe("Test go", () => {
    it("should run", async () => {
      fail();
    });
  });

  describe("Test php", () => {
    it("should run", async () => {
      fail();
    });
  });
});