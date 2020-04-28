import * as Dimension from '../src';
import { DominationDesign } from './domination';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from "sinon-chai";
import 'mocha';
import { Station, Logger } from '../src';
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiAsPromised);

const importTest = (name:string, path: string) => {
  describe(name, function () {
      require(path);
  });
}

let station: Station;
describe.only('Testing Station Class', () => {
  it('should not activate a station when asked', () => {
    let dominationDesign = new DominationDesign('Domination');
    let d = Dimension.create(dominationDesign, {
      activateStation: false,
      observe: false,
      loggingLevel: Logger.LEVEL.NONE
    });
    station = d.getStation();
    expect(station).to.equal(null);
  });
  it('should activate a station when asked but also not observe if necessary', () => {
    let dominationDesign = new DominationDesign('Domination');
    let d = Dimension.create(dominationDesign, {
      activateStation: true,
      observe: false,
      loggingLevel: Logger.LEVEL.NONE
    });
    station = d.getStation();
    expect(station).to.not.equal(null);
    let dimensions = <Array<Dimension.DimensionType>>station.app.get('dimensions');
    expect(dimensions.length).to.equal(0);
  });
  it('should observe if asked', () => {
    let dominationDesign = new DominationDesign('Domination');
    let d = Dimension.create(dominationDesign, {
      observe: true,
      loggingLevel: Logger.LEVEL.NONE
    });
    station = d.getStation();
    expect(station).to.not.equal(null);
    let dimensions = <Array<Dimension.DimensionType>>station.app.get('dimensions');
    expect(dimensions[0].id).to.equal(d.id);
  });
  describe('Run imported', () => {
    importTest('DimensionsAPI', './stationAPITests/dimension.subspec.ts');
  });
  after(() => {
    station.stop();
  });

  
});