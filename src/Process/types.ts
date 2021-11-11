export interface PromiseStructure {
  promise: Promise<string>;
  res: Function;
  rej: Function;
}

export interface ProcessOptions {
  time: {
    /**
     * Amount of time in ms an agent is allotted per step. This time is calculated by checking how long it takes for an agent to receive inputs and produce outputs.
     *
     * If set to null, no timer is set
     *
     * @default `2000`
     */
    perStep: number;
    /**
     * Pool of time in ms that is tapped into each step an agent spends more than the time allotted per step
     *
     * @default `60000`
     */
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
