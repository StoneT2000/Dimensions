export default class VarLock {
  public lock: Promise<void>;
  private promiseRes: Function;
  private rejectRes: Function;
  /**
   * Creating an instance of this automatically locks it
   */
  constructor() {
    this.lockvar();
  }
  /**
   * First waits for existing lock to release before locking right away again
   */
  async lockvar(): Promise<void> {
    if (this.lock) {
      await this.lock;
    }
    this.lock = new Promise((resolve, reject) => {
      this.promiseRes = resolve;
      this.rejectRes = reject;
    });
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  unlock(data?: any): void {
    this.promiseRes(data);
  }
  unlockWithError(err: Error): void {
    this.rejectRes(err);
  }
}
