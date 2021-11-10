export interface PromiseStructure {
  promise: Promise<string>;
  res: Function;
  rej: Function;
}

export interface ProcessOptions {
  time: {
    perStep: number;
    overage: number;
  };
  memory: {
    limit: number;
  };
}

export interface DockerProcessOptions extends ProcessOptions {
  image: string;
  name: string;
  socketPath: string;
}
