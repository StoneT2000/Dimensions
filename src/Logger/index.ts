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
  public identifier = 'Log'
  constructor(public level: LoggerLEVEL = Logger.LEVEL.INFO) {

  }
  bar() {
     return `-=-=-=-=-=-=-=-=-=-=-=-| ${this.identifier} |-=-=-=-=-=-=-=-=-=-=-=-`;
  }
  systembar() {
    if (this.level >= Logger.LEVEL.SYSTEM) console.log(this.bar());
  }
  system(message?) {
    if (this.level >= Logger.LEVEL.SYSTEM) console.log(`(SYSTEM) (${this.identifier}) - ${message}`);
  }
  detail(message?) {
    if (this.level >= Logger.LEVEL.DETAIL) console.log(`(DETAIL) (${this.identifier}) - ${message}`);
  }
  detailbar() {
    if (this.level >= Logger.LEVEL.DETAIL) console.log(this.bar());
  }
  infobar() {
    if (this.level >= Logger.LEVEL.INFO) console.log(this.bar());
  }
  info(message?) {
    if (this.level >= Logger.LEVEL.INFO) console.log(`(INFO) (${this.identifier}) - ${message}`);
  }
  warnbar() {
    if (this.level >= Logger.LEVEL.WARN) console.log(this.bar());
  }
  warn(message?) {
    if (this.level >= Logger.LEVEL.WARN) console.log(`(WARN) (${this.identifier}) - ${message}`);
  }
  errorbar() {
    if (this.level >= Logger.LEVEL.ERROR) console.log(this.bar());
  }
  error(message?) {
    if (this.level >= Logger.LEVEL.ERROR) console.log(`(ERROR) (${this.identifier}) - ${message}`);
  }
}
