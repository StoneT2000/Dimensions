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
  constructor(public level: LoggerLEVEL = Logger.LEVEL.INFO) {

  }
  static bar = '-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-'
  systembar() {
    if (this.level >= Logger.LEVEL.SYSTEM) console.log(Logger.bar);
  }
  system(message?) {
    if (this.level >= Logger.LEVEL.SYSTEM) console.log(`(SYSTEM) ${message}`);
  }
  detail(message?) {
    if (this.level >= Logger.LEVEL.DETAIL) console.log(`(DETAIL) ${message}`);
  }
  detailbar() {
    if (this.level >= Logger.LEVEL.DETAIL) console.log(Logger.bar);
  }
  infobar() {
    if (this.level >= Logger.LEVEL.INFO) console.log(Logger.bar);
  }
  info(message?) {
    if (this.level >= Logger.LEVEL.INFO) console.log(`(INFO) ${message}`);
  }
  warnbar() {
    if (this.level >= Logger.LEVEL.WARN) console.log(Logger.bar);
  }
  warn(message?) {
    if (this.level >= Logger.LEVEL.WARN) console.log(`(WARN) ${message}`);
  }
  errorbar() {
    if (this.level >= Logger.LEVEL.ERROR) console.log(Logger.bar);
  }
  error(message?) {
    if (this.level >= Logger.LEVEL.ERROR) console.log(`(ERROR) ${message}`);
  }
}
