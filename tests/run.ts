import * as Dimensions from '../src';
import path from 'path';
const dim = new Dimensions.Dimension({
  name: 'Test',
  environment: path.join(__dirname, 'pendulum.py')
});
const env = dim.make();
// collect agent actions
const run = async () => {
  let res = await env.setup();
  console.log(1, res);
  res = await env.step([{action: Math.random()}])
  console.log(res);
  const N = 4;
  for (let step = 0; step < N; step++) {
    res = await env.step([{action: Math.random()}])
    console.log(res);
  }
  res = await env.reset();
  console.log(res);
}
// env.step();
run()