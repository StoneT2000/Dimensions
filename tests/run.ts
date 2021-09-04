import * as Dimensions from '../src';
import path from 'path';
const dim = new Dimensions.Dimension({
  name: 'Test',
  environment: path.join(__dirname, 'pendulum.py')
});
const env = dim.make();
// collect agent actions

// env.step();
