import { EventEmitter, Readable, Writable } from 'stream';

export class DockerProcess extends EventEmitter {
  // TODO: using dockerode and stuff to start a docker based process
  stdin: Writable | null;
  stdout: Readable | null;
  stderr: Readable | null;
  pid: number;
  constructor() {
    super();
  }
}
