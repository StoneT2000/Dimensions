export interface PromiseStructure {
  promise: Promise<string>;
  res: Function;
  rej: Function;
}