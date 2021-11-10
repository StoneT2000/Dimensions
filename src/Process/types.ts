export interface PromiseStructure {
  promise: Promise<string>;
  res: Function;
  rej: Function;
}

export interface ProcessOptions {
  time: {
    perStep: 2000;
    overage: 60000;
  };
}
