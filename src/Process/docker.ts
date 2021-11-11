import { Logger } from '../Logger';
import { Process } from '.';
import { Events as ProcessEvents} from './events';
import { DeepPartial } from '../utils/DeepPartial';
import { DockerProcessOptions } from './types';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Dockerode, { HostConfig } from 'dockerode';
import { dockerCopy } from '../utils/System';
import { Writable, Readable, Stream, Duplex } from 'stream';
import DefaultSeccompProfileJSON from './seccomp/default.json';
import { deepMerge } from '../utils/DeepMerge';
import path from 'path';
import { genID } from '../utils';
const DefaultSeccompProfileString = JSON.stringify(DefaultSeccompProfileJSON);

export class DockerProcess extends Process {
  /**
   * Streams associated with the agent
   */
  public p: Streams = {
    stdin: null,
    stdout: null,
    stderr: null,
  };
  public container: Dockerode.Container = null;
  public options: DockerProcessOptions = {
    time: {
      perStep: 2000,
      overage: 60000,
    },
    memory: {
      // 1073741824 = 1024^3 = 1 GB
      limit: 1073741824,
    },
    image: 'stonet2000/dimensions',
    name: null,
    socketPath: '/var/run/docker.sock',
  };
  public docker: Dockerode;
  public pid: string;
  constructor(
    public command: string,
    public args: string[] = [],
    public cwd: string,
    options?: DeepPartial<DockerProcessOptions>
  ) {
    super(command, args, options);
    this.options = deepMerge(this.options, options);
    if (this.options.name == null) {
      this.options.name = genID(20);
    }
    this.docker = new Dockerode({ socketPath: this.options.socketPath });
  }
  async _init(): Promise<void> {
    // throw new Error('Method not implemented.');
    await this.setupContainer(this.options.name, this.docker);
    const p = await this.containerSpawn(this.command);
    this.p.stdin = p.stdin;
    this.p.stdout = p.stdout;
    this.p.stderr = p.stderr;
    this.pid = `docker_${this.options.name}`;
    Process.allProcesses.set(this.pid, this);
    this.log.identifier = `[docker_${this.options.name}]`;
    p.stream.on('exit', (code) => {
      if (code) {
        // some failure occurred.
        this.log.error(`Process exited with code ${code}`);
        this.emit(ProcessEvents.EXIT, code);
      }
    });
    this.p.stdout.on('readable', () => {
      let data: Array<string>;
      while ((data = this.p.stdout.read())) {
        // split chunks into line by line and push into buffer
        const strs = `${data}`.split(/\r?\n/);
        for (let i = 0; i < strs.length - 1; i++) {
          this._buffer.stdout.push(strs[i]);
        }
        // resolve stdout promise to unblock anyone calling readstdout
        this._promises.stdout.res(data);
        this._promises.stdout = this._createPromiseStructure();
      }
    });
    this.p.stderr.on('readable', () => {
      let data: Array<string>;
      while ((data = this.p.stderr.read())) {
        this.log.custom(
          this.log.identifier.blue,
          Logger.LEVEL.ERROR,
          `${data}`
        );
      }
    });
  }
  async _send(message: string): Promise<void> {
    return new Promise((res, rej) => {
      this.p.stdin.write(`${message}\n`, (err) => {
        if (err) rej(err);
        else res();
      });
    });
  }
  async _close(): Promise<void> {
    const ins = await this.container.inspect();
    // clearInterval(this.memoryWatchInterval);
    if (ins.State.Running) {
      Process.allProcesses.delete(this.pid);

      await this.container.kill();
    }
  }
  async _pause(): Promise<void> {
    // await this.container.pause();
    // throw new Error('Method not implemented.');
  }
  async _resume(): Promise<void> {
    // await this.container.unpause();
  }

  async setupContainer(name: string, docker: Dockerode): Promise<void> {
    const HostConfig: HostConfig = {
      // apply seccomp profile for security
      SecurityOpt: [`seccomp=${DefaultSeccompProfileString}`],
      AutoRemove: true,
    };
    if (this.options.memory.limit != -1) {
      HostConfig.Memory = this.options.memory.limit;
    }
    const container = await docker.createContainer({
      Image: this.options.image,
      name: name,
      OpenStdin: true,
      StdinOnce: true,
      HostConfig,
    });
    this.log.system(`Created container ${name}`);

    // store container
    this.container = container;
    await container.start();
    this.log.system(`Started container ${name}`);

    // copy bot directory into container
    await dockerCopy(this.cwd, name, '/code');
    this.log.system(`Copied bot into container ${name}`);
  }

  /**
   * Executes the given command string in the agent's container and attaches stdin, stdout, and stderr accordingly
   * @param command - the command to execute in the container
   */
  async containerSpawn(
    command: string,
    workingDir = '/code'
  ): Promise<ContainerExecData> {
    const file = path.join('/code', path.basename(command));
    const exec = await this.container.exec({
      Cmd: ['/bin/sh', '-c', file],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: workingDir,
    });

    const stream = await exec.start({ stdin: true, hijack: true });
    const instream = new Stream.PassThrough();
    const outstream = new Stream.PassThrough();
    const errstream = new Stream.PassThrough();
    instream.pipe(stream);
    this.container.modem.demuxStream(stream, outstream, errstream);

    return {
      stdin: instream,
      stdout: outstream,
      stderr: errstream,
      stream,
      exec,
    };
  }
}
export interface Streams {
  stdin: Writable;
  stdout: Readable;
  stderr: Readable;
}
export interface ContainerExecData extends Streams {
  exec: Dockerode.Exec;
  stream: Duplex;
}
