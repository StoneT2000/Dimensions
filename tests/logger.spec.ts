import * as Dimension from '../src';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon, { SinonSandbox } from "sinon";
import sinonChai from "sinon-chai";
import 'mocha';
import { LoggerLEVEL } from '../src';
import colors from 'colors';
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('Test Logger', () => {
  let log = new Dimension.Logger();
  let consoleSpy, sandbox: SinonSandbox;
  
  const init = (level: LoggerLEVEL) => {
    log.level = level;
    log.systemIO('hello-sysIO');
    log.system2('hello-sys2');
    log.system('hello-sys');
    log.detail('hello-det');
    log.info('hello-info');
    log.warn('hello-warn');
    log.error('hello-error');
  }
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    consoleSpy = sandbox.spy(console, 'log');
    log = new Dimension.Logger();
  });
  afterEach(() => {
    sandbox.restore();
  })
  it('Default INFO level logging', () => {
    expect(log.level).to.equal(Dimension.Logger.LEVEL.INFO);
  })
  it('Level INFO', () => {
    
    init(LoggerLEVEL.INFO);
    expect(consoleSpy).to.have.been.calledWith(colors.blue('[INFO]') + ' (Log) -', 'hello-info');
    expect(consoleSpy).to.have.been.calledWith(colors.yellow('[WARN]') + ' (Log) -', 'hello-warn');
    expect(consoleSpy).to.have.been.calledWith(colors.red('[ERROR]') + ' (Log) -', 'hello-error');
  });
  it('Level SYSTEM', () => {
    init(LoggerLEVEL.SYSTEM);
    expect(consoleSpy).to.have.been.calledWith(colors.blue('[INFO]') + ' (Log) -', 'hello-info');
    expect(consoleSpy).to.have.been.calledWith(colors.yellow('[WARN]') + ' (Log) -', 'hello-warn');
    expect(consoleSpy).to.have.been.calledWith(colors.red('[ERROR]') + ' (Log) -', 'hello-error');
    expect(consoleSpy).to.have.been.calledWith(colors.red('[SYSTEM]') + ' (Log) -', 'hello-sys');
    expect(consoleSpy).to.have.been.calledWith(colors.gray('[DETAIL]') + ' (Log) -', 'hello-det');
  });
})