import colors from 'colors';
/**
 * Dimensions Logging Class
 */
export class Logger {
  /**
   * Identifier of who is logging this
   * @default 'Log'
   */
  public identifier: string;
  /**
   * Color of the identifier string
   * @default Bold Green
   */
  public identifierColor = colors.bold.green;

  /**
   * Logger Constructor
   * @param level - The logging level to use
   * @param identifier - an identifier to identify which logger is being called
   */
  constructor(
    public level: Logger.LEVEL = Logger.LEVEL.INFO,
    identifier = 'Log'
  ) {
    this.identifier = identifier;
  }
  getIdentifier(): string {
    return this.identifierColor(this.identifier);
  }
  bar(type = ''): string {
    return `\n-=-=-=-=-=-=-=-=-=-=-=-| ${type} ${this.getIdentifier()} |-=-=-=-=-=-=-=-=-=-=-=-\n`;
  }

  // important are messages that cannot be removed, they will always display
  importantBar(): void {
    console.log(this.bar(colors.red('[IMPORTANT]')));
  }
  important(...message: any[]): void {
    console.log(
      `${colors.red('[IMPORTANT]')} (${this.identifier}) -`,
      ...message
    );
  }
  systemIObar(): void {
    if (this.level >= Logger.LEVEL.SYSTEM_IO)
      console.log(this.bar(colors.red('[SYSTEM I/O]')));
  }
  systemIO(...message: any[]): void {
    if (this.level >= Logger.LEVEL.SYSTEM_IO)
      console.log(
        `${colors.red('[SYSTEM I/O]')} (${this.identifier}) -`,
        ...message
      );
  }
  systembar(): void {
    if (this.level >= Logger.LEVEL.SYSTEM)
      console.log(this.bar(colors.red('[SYSTEM]')));
  }
  system(...message: any[]): void {
    if (this.level >= Logger.LEVEL.SYSTEM)
      console.log(
        `${colors.red('[SYSTEM]')} (${this.identifier}) -`,
        ...message
      );
  }
  detailbar(): void {
    if (this.level >= Logger.LEVEL.DETAIL)
      console.log(this.bar(colors.grey('[DETAIL]')));
  }
  detail(...message: any[]): void {
    if (this.level >= Logger.LEVEL.DETAIL)
      console.log(
        `${colors.grey('[DETAIL]')} (${this.identifier}) -`,
        ...message
      );
  }
  infobar(): void {
    if (this.level >= Logger.LEVEL.INFO)
      console.log(this.bar(colors.blue('[INFO]')));
  }
  info(...message: any[]): void {
    if (this.level >= Logger.LEVEL.INFO)
      console.log(
        `${colors.blue('[INFO]')} (${this.identifier}) -`,
        ...message
      );
  }
  warnbar(): void {
    if (this.level >= Logger.LEVEL.WARN)
      console.log(this.bar(colors.yellow('[WARN]')));
  }
  warn(...message: any[]): void {
    if (this.level >= Logger.LEVEL.WARN)
      console.log(
        `${colors.yellow('[WARN]')} (${this.identifier}) -`,
        ...message
      );
  }
  errorbar(): void {
    if (this.level >= Logger.LEVEL.ERROR)
      console.log(this.bar(colors.red('[ERROR]')));
  }
  error(...message: any[]): void {
    if (this.level >= Logger.LEVEL.ERROR)
      console.log(
        `${colors.red('[ERROR]')} (${this.identifier}) -`,
        ...message
      );
  }
  custom(label: string, level: Logger.LEVEL, ...message: any[]): void {
    if (this.level >= level) {
      process.stdout.write(`${label} ${message.join(' ')}`);
    }
  }
}
export namespace Logger {
  /**
   * Logging Levels where the order of levels are NONE, ERROR, ..., SYSTEM_IO, ALL
   */
  export enum LEVEL {
    /** No logs */
    NONE,
    /** Error logs */
    ERROR,
    /** Warning logs */
    WARN,
    /** Info logs */
    INFO,
    /** Detail logs. For finer details above INFO and below SYSTEM */
    DETAIL,
    /** System level logs */
    SYSTEM,
    /** System IO logs. All I/O related details */
    SYSTEM_IO,
    /** All logs */
    ALL,
  }
}
