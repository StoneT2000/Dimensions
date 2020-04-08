import colors from 'colors';
/**
 * Dimensions Logging Class
 * @param level - The logging level to use
 * @param identifier - an identifier to identify which logger is being called
 */
export class Logger {
  public identifier: string; // an identifier for who is logging this
  //@ts-ignore
  public identifierColor = colors.bold.green;
  constructor(public level: Logger.LEVEL = Logger.LEVEL.INFO, identifier = 'Log') {
    this.identifier = identifier;
  }
  getIdentifier() {
    return this.identifierColor(this.identifier);
  }
  bar(type: string = '') {
     return `\n-=-=-=-=-=-=-=-=-=-=-=-| ${type} ${this.getIdentifier()} |-=-=-=-=-=-=-=-=-=-=-=-\n`;
  }
  systemIObar() {
    if (this.level >= Logger.LEVEL.SYSTEM_IO) console.log(this.bar(colors.red('[SYSTEM I/O]')));
  }
  systemIO(...message: any[]) {
    if (this.level >= Logger.LEVEL.SYSTEM_IO) console.log(`${colors.red('[SYSTEM I/O]')} (${this.identifier}) -`, ...message);
  }
  systembar2() {
    if (this.level >= Logger.LEVEL.SYSTEM2) console.log(this.bar(colors.red('[SYSTEM 2]')));
  }
  system2(...message: any[]) {
    if (this.level >= Logger.LEVEL.SYSTEM2) console.log(`${colors.red('[SYSTEM 2]')} (${this.identifier}) -`, ...message);
  }
  systembar() {
    if (this.level >= Logger.LEVEL.SYSTEM) console.log(this.bar(colors.red('[SYSTEM]')));
  }
  system(...message: any[]) {
    if (this.level >= Logger.LEVEL.SYSTEM) console.log(`${colors.red('[SYSTEM]')} (${this.identifier}) -`, ...message);
  }  
  detailbar() {
    if (this.level >= Logger.LEVEL.DETAIL) console.log(this.bar(colors.grey('[DETAIL]')));
  }
  detail(...message: any[]) {
    if (this.level >= Logger.LEVEL.DETAIL) console.log(`${colors.grey('[DETAIL]')} (${this.identifier}) -`, ...message);
  }
  infobar() {
    if (this.level >= Logger.LEVEL.INFO) console.log(this.bar(colors.blue('[INFO]')));
  }
  info(...message: any[]) {
    if (this.level >= Logger.LEVEL.INFO) console.log(`${colors.blue('[INFO]')} (${this.identifier}) -`, ...message);
  }
  warnbar() {
    if (this.level >= Logger.LEVEL.WARN) console.log(this.bar(colors.yellow('[WARN]')));
  }
  warn(...message: any[]) {
    if (this.level >= Logger.LEVEL.WARN) console.log(`${colors.yellow('[WARN]')} (${this.identifier}) -`, ...message);
  }
  errorbar() {
    if (this.level >= Logger.LEVEL.ERROR) console.log(this.bar(colors.red('[ERROR]')));
  }
  error(...message: any[]) {
    if (this.level >= Logger.LEVEL.ERROR) console.log(`${colors.red('[ERROR]')} (${this.identifier}) -`, ...message);
  }
}
export module Logger {
  export enum LEVEL {
    NONE, // no logs
    ERROR, // error logs
    WARN, // TODO come up with a name that goes between warn and info
    INFO, // for informational things user should know about
    DETAIL, // for finer details
    SYSTEM, // for high level system logs
    SYSTEM2, // unused
    SYSTEM_IO, // all lower level I/O related details (including the actual input and output of engine and agents)
    ALL
  }
}