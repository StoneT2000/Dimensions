import * as Dimensions from '../src';
import path from 'path';

const dim = new Dimensions.Dimension({
  name: 'Test',
  environment: path.join(__dirname, 'pendulum.py')
});
const env = dim.makeEnv();

const benchmark = async () => {
  const agent = dim.addAgent({
    agent: path.join(__dirname, 'agent.sh')
  })
  await agent.initialize();
  await env.setup(); // call once only
  
  let res = await env.reset(); // create new initial state
  
  // agent.action()
  const N = 2;
  const stime = performance.now();
  for (let step = 0; step < N; step++) {
    console.log(res)
    const action = await agent.action(res);
    
    res = await env.step([action]);
    // re = JSON.parse(res)["obs"]
  }
  const elapsed = performance.now() - stime;
  console.log({
    elapsed,
    msPerStep: elapsed / N
  });
  res = await env.reset();
  console.log(res);
  await env.close();

  await dim.cleanup();
}
benchmark()