import * as Dimensions from '../src';
import path from 'path';

const dim = new Dimensions.Dimension({
  name: 'Test',
  // environment: path.join(__dirname, 'pendulum.py')
});

const agentPath = path.join(__dirname, 'agent.sh');
const benchmark = async () => {
  const env = await dim.makeEnv(path.join(__dirname, 'pendulum.py'), {
    max_steps: 10
  });
  const results = await dim.runEpisode(env, [agentPath]);
  console.log({results})
  env.close();
  await dim.cleanup();
}
benchmark()