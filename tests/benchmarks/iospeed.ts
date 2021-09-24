import {Process} from '../../src/Process';

const run = async () => {
  const p = new Process('node', [`${__dirname}/sub.js`]);

  const N = 10;
  let data = '';
  const bytes = 1024*1024*32;// * 1024;
  for (let i = 0; i < bytes; i++) {
    data += 'a'
  }
  function byteCount(s) {
    return encodeURI(s).split(/%..|./).length - 1;
  }
  console.log(`Sending ${byteCount(data)} bytes ${N} times`)
  const stime = performance.now();
  for (let i = 0; i < N; i++) {
    await p.send(data);
    await p.readstdout();
  }
  const etime = performance.now();
  const tt = etime - stime;
  console.log(`Elapsed ${(tt)}ms`);
  console.log(`Elapsed ${N/(tt)} rounds/ms`);
  console.log(`${bytes/(tt)} bytes/ms`);
  p.close();
}
run();