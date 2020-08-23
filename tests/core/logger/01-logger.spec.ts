import * as Dimension from '../../../src';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon, { SinonSandbox } from 'sinon';
import sinonChai from 'sinon-chai';
import 'mocha';
import { Logger } from '../../../src';
import colors from 'colors';
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('Test Logger', () => {
  let log = new Dimension.Logger();
  let consoleSpy, sandbox: SinonSandbox;

  const init = (level: Logger.LEVEL) => {
    log.level = level;
    log.systemIO('hello-sysIO');
    log.system('hello-sys');
    log.detail('hello-det');
    log.info('hello-info');
    log.warn('hello-warn');
    log.error('hello-error');
  };
  const initBars = (level: Logger.LEVEL) => {
    log.level = level;
    log.systemIObar();
    log.systembar();
    log.errorbar();
    log.warnbar();
    log.infobar();
    log.detailbar();
  };
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    consoleSpy = sandbox.spy(console, 'log');
    log = new Dimension.Logger();
  });
  afterEach(() => {
    sandbox.restore();
  });
  it('Default INFO level logging', () => {
    expect(log.level).to.equal(Dimension.Logger.LEVEL.INFO);
  });
  it('Level INFO', () => {
    init(Logger.LEVEL.INFO);
    expect(consoleSpy).to.have.been.calledWith(
      colors.blue('[INFO]') + ' (Log) -',
      'hello-info'
    );
    expect(consoleSpy).to.have.been.calledWith(
      colors.yellow('[WARN]') + ' (Log) -',
      'hello-warn'
    );
    expect(consoleSpy).to.have.been.calledWith(
      colors.red('[ERROR]') + ' (Log) -',
      'hello-error'
    );
  });
  it('Level SYSTEM', () => {
    init(Logger.LEVEL.SYSTEM);
    expect(consoleSpy).to.have.been.calledWith(
      colors.blue('[INFO]') + ' (Log) -',
      'hello-info'
    );
    expect(consoleSpy).to.have.been.calledWith(
      colors.yellow('[WARN]') + ' (Log) -',
      'hello-warn'
    );
    expect(consoleSpy).to.have.been.calledWith(
      colors.red('[ERROR]') + ' (Log) -',
      'hello-error'
    );
    expect(consoleSpy).to.have.been.calledWith(
      colors.red('[SYSTEM]') + ' (Log) -',
      'hello-sys'
    );
    expect(consoleSpy).to.have.been.calledWith(
      colors.gray('[DETAIL]') + ' (Log) -',
      'hello-det'
    );
  });

  it('Level ALL', () => {
    init(Logger.LEVEL.ALL);
    expect(consoleSpy).to.have.been.calledWith(
      colors.blue('[INFO]') + ' (Log) -',
      'hello-info'
    );
    expect(consoleSpy).to.have.been.calledWith(
      colors.yellow('[WARN]') + ' (Log) -',
      'hello-warn'
    );
    expect(consoleSpy).to.have.been.calledWith(
      colors.red('[ERROR]') + ' (Log) -',
      'hello-error'
    );
    expect(consoleSpy).to.have.been.calledWith(
      colors.red('[SYSTEM]') + ' (Log) -',
      'hello-sys'
    );
    expect(consoleSpy).to.have.been.calledWith(
      colors.gray('[DETAIL]') + ' (Log) -',
      'hello-det'
    );
    expect(consoleSpy).to.have.been.calledWith(
      colors.red('[SYSTEM I/O]') + ' (Log) -',
      'hello-sysIO'
    );
  });

  it('Level ALL, printing bars', () => {
    initBars(Logger.LEVEL.ALL);
    expect(consoleSpy).to.have.been.calledWith(
      log.bar(colors.red('[SYSTEM I/O]'))
    );
    expect(consoleSpy).to.have.been.calledWith(log.bar(colors.red('[SYSTEM]')));
    expect(consoleSpy).to.have.been.calledWith(log.bar(colors.red('[ERROR]')));
    expect(consoleSpy).to.have.been.calledWith(
      log.bar(colors.yellow('[WARN]'))
    );
    expect(consoleSpy).to.have.been.calledWith(log.bar(colors.blue('[INFO]')));
    expect(consoleSpy).to.have.been.calledWith(
      log.bar(colors.gray('[DETAIL]'))
    );
    log.important('hello-important');
    log.importantBar();
    log.bar();
    expect(consoleSpy).to.have.been.calledWith(
      log.bar(colors.red('[IMPORTANT]'))
    );
    expect(consoleSpy).to.have.been.calledWith(
      colors.red('[IMPORTANT]') + ' (Log) -',
      'hello-important'
    );
  });
  it('Level ALL, printing bars', () => {
    init(Logger.LEVEL.NONE);
    initBars(Logger.LEVEL.NONE);
    expect(consoleSpy).to.not.have.been.called;
  });
});
