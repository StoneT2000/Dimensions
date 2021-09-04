import * as Dimensions from '../src';
import path from 'path';

const dim = new Dimensions.Dimension({
  name: 'Test',
  environment: path.join(__dirname, 'pendulum.py')
});
const env = dim.makeEnv();

const benchmark = async () => {
  let res = await env.setup();
  const N = 100000;
  const stime = performance.now();
  for (let step = 0; step < N; step++) {
    res = await env.step([{action: 0.1}])
  }
  const elapsed = performance.now() - stime;
  console.log({
    elapsed,
    msPerStep: elapsed / N
  });
  res = await env.reset();
  console.log(res);
  await env.close();
}
benchmark()