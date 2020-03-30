import colors, { Color } from 'colors';

export enum LoggerLEVEL  {
  NONE,
  ERROR,
  WARN,
  INFO, // for informational things user should know about
  DETAIL, // for finer details
  SYSTEM, // for practically all system output details
  ALL
}
/**
 * Dimensions Logging Class
 */
export class Logger {
  public static LEVEL = LoggerLEVEL;
  public identifier: string; // an identifier for who is logging this
  //@ts-ignore
  public identifierColor = colors.bold.green;
  constructor(public level: LoggerLEVEL = Logger.LEVEL.INFO, identifier = 'Log') {
    this.identifier = identifier;
  }
  getIdentifier() {
    return this.identifierColor(this.identifier);
  }
  bar(type: string = '') {
     return `\n-=-=-=-=-=-=-=-=-=-=-=-| ${type} ${this.getIdentifier()} |-=-=-=-=-=-=-=-=-=-=-=-\n`;
  }
  systembar() {
    if (this.level >= Logger.LEVEL.SYSTEM) console.log(this.bar(colors.red('[SYSTEM]')));
  }
  system(message?) {
    if (this.level >= Logger.LEVEL.SYSTEM) console.log(`${colors.red('[SYSTEM]')} (${this.identifier}) - ${message}`);
  }
  detail(message?) {
    if (this.level >= Logger.LEVEL.DETAIL) console.log(`${colors.grey('[DETAIL]')} (${this.identifier}) - ${message}`);
  }
  detailbar() {
    if (this.level >= Logger.LEVEL.DETAIL) console.log(this.bar(colors.grey('[DETAIL]')));
  }
  infobar() {
    if (this.level >= Logger.LEVEL.INFO) console.log(this.bar(colors.blue('[INFO]')));
  }
  info(message?) {
    if (this.level >= Logger.LEVEL.INFO) console.log(`${colors.blue('[INFO]')} (${this.identifier}) - ${message}`);
  }
  warnbar() {
    if (this.level >= Logger.LEVEL.WARN) console.log(this.bar(colors.yellow('[WARN]')));
  }
  warn(message?) {
    if (this.level >= Logger.LEVEL.WARN) console.log(`${colors.yellow('[WARN]')} (${this.identifier}) - ${message}`);
  }
  errorbar() {
    if (this.level >= Logger.LEVEL.ERROR) console.log(this.bar(colors.red('[ERROR]')));
  }
  error(message?) {
    if (this.level >= Logger.LEVEL.ERROR) console.log(`${colors.red('[ERROR]')} (${this.identifier}) - ${message}`);
  }
}
