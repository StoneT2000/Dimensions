const Docker = require('dockerode');
const { WriteStream, ReadStream } = require('fs');
// import { Stream } from 'stream';
const { Stream } = require('stream');
const docker = new Docker({socketPath: '/var/run/docker.sock'});
const s = new Stream.PassThrough();
const instream = new Stream.PassThrough();

// docker.run('docker.io/stonezt2000/dimensions_langs', ['python'], process.stdout, {
//   OpenStdin: true,
//   StdinOnce: true,
// }, {

// } (err, container) => {
//   console.log(container);
// });
// const seccompprofile = require("./seccomp.json");
// console.log(seccompprofile)
docker.createContainer({Image: 'alpine', name: 'agent_i', 
  // AttachStdin: true,
  // AttachStdout: true,
  // AttachStderr: true,
  // Tty: true,
  OpenStdin: true,
  StdinOnce: true,
  // Cmd: ['/bin/bash', '-c', 'node /root/rockdir/rock.js'],
  HostConfig: {
    AutoRemove: true,
  }
}, function (err, container) {
  
  if (err) return console.error(err);  
  container.inspect().then((i) => {
    console.log(i.HostConfig);
  })
  // container.attach({stream: true, stdout: true, stderr: true, stdin: true}, function (err, stream) {
  //   // let outstream = 
  //   // outstream.pipe(process.stdout);
  //   container.modem.demuxStream(stream, s, process.stderr);
  //   // s.pipe(process.stdout);
  //   s.on('data', (d) => {
  //     console.log(`${d}`);
  //   })
  //   instream.pipe(stream);
  //   // console.log(container.modem.demuxStream);
  //   // stream.pipe(process.stdout);
  //   // docker.modem.demuxStream(stream, process.stdout, process.stderr);
  //   // stream.write("3\n4\n");
    
  // });
 
  // let i = 0;`
  container.start(function (err, data) {
    // console.log('data', data);
    // data.write("3\n4\n");
    if(err) console.error(err);
    console.log(`${data}`);
    container.exec({
      Cmd: ['/bin/bash', '-c', 'mkdir temp && cd temp && echo 3'],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
    }).then(async (exec) => {
      exec.start({stdin: true, hijack: true}, (err, stream) => {
        instream.pipe(stream);
        docker.modem.demuxStream(stream, s, process.stderr);
        s.on('data', (d) => {
          console.log(`${d}`);
        });
        stream.on('close', () => {
          console.log("done");
          exec.inspect().then((r) => console.log(r));
          container.kill();
        })
      })
      
    }).catch((r) => {
      console.error(r);
    })
  });
});
  //...