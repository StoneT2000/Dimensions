import gym
from gym import spaces
from gym.utils import seeding
import numpy as np
from os import path


class PendulumEnv(gym.Env):
    metadata = {"render.modes": ["human", "rgb_array"], "name": "Pendulum-v0"}

    def __init__(self, g=10.0, max_steps=300):
        self.max_steps = max_steps
        self.curr_step = 0
        self.max_speed = 8
        self.max_torque = 2.0
        self.dt = 0.05
        self.g = g
        self.m = 1.0
        self.l = 1.0
        self.viewer = None

        high = np.array([1.0, 1.0, self.max_speed], dtype=np.float32)
        self.action_space = spaces.Box(
            low=-self.max_torque, high=self.max_torque, shape=(1,), dtype=np.float32
        )
        self.observation_space = spaces.Box(low=-high, high=high, dtype=np.float32)

        self.seed()

    def seed(self, seed=None):
        self.np_random, seed = seeding.np_random(seed)
        return [seed]

    def validate_action(self, u):
        assert 'actions' in u
        u = u['actions']
        assert isinstance(u, list) == False, "Did not receive a proper action"
    def step(self, u):
        self.validate_action(u)
        u = u['actions']
        
        # should be validating the action format here
        u = np.array([float(u)])

        self.curr_step += 1
        th, thdot = self.state  # th := theta

        g = self.g
        m = self.m
        l = self.l
        dt = self.dt

        if u is None:
            u = np.array([0])

        u = np.clip(u, -self.max_torque, self.max_torque)[0]
        self.last_u = u  # for rendering
        costs = angle_normalize(th) ** 2 + 0.1 * thdot ** 2 + 0.001 * (u ** 2)

        newthdot = (
            thdot
            + (-3 * g / (2 * l) * np.sin(th + np.pi) + 3.0 / (m * l ** 2) * u) * dt
        )
        newth = th + newthdot * dt
        newthdot = np.clip(newthdot, -self.max_speed, self.max_speed)

        self.state = np.array([newth, newthdot])
        return self._get_obs(), -costs, self.curr_step >= self.max_steps, {}

    def reset(self, state=None):
        high = np.array([np.pi, 1])
        if state is not None:
            self.state = state
        else:
            self.state = self.np_random.uniform(low=-high, high=high)
        self.last_u = None
        return self._get_obs()

    def _get_obs(self):
        theta, thetadot = self.state
        return np.array([np.cos(theta), np.sin(theta), thetadot], dtype=np.float32)

    def render(self, mode="human"):
        if self.viewer is None:
            from gym.envs.classic_control import rendering

            self.viewer = rendering.Viewer(500, 500)
            self.viewer.set_bounds(-2.2, 2.2, -2.2, 2.2)
            rod = rendering.make_capsule(1, 0.2)
            rod.set_color(0.8, 0.3, 0.3)
            self.pole_transform = rendering.Transform()
            rod.add_attr(self.pole_transform)
            self.viewer.add_geom(rod)
            axle = rendering.make_circle(0.05)
            axle.set_color(0, 0, 0)
            self.viewer.add_geom(axle)
            fname = path.join(path.dirname(__file__), "assets/clockwise.png")
            self.img = rendering.Image(fname, 1.0, 1.0)
            self.imgtrans = rendering.Transform()
            self.img.add_attr(self.imgtrans)

        self.viewer.add_onetime(self.img)
        self.pole_transform.set_rotation(self.state[0] + np.pi / 2)
        if self.last_u is not None:
            self.imgtrans.scale = (-self.last_u / 2, np.abs(self.last_u) / 2)

        return self.viewer.render(return_rgb_array=mode == "rgb_array")

    def close(self):
        if self.viewer:
            self.viewer.close()
            self.viewer = None



def angle_normalize(x):
    return ((x + np.pi) % (2 * np.pi)) - np.pi



if __name__ == "__main__":
    def read_input():
        """
        Reads input from stdin
        """
        try:
            return input()
        except EOFError as eof:
            raise SystemExit(eof)
    def output(data):
        json.dump(data, sys.stdout)
        sys.stdout.write("\n")

    import json
    import sys

    def serialize_np(arr):
        return arr.tolist()

    env = None
    while (True):
        inputs = read_input()
        data = json.loads(inputs) # load into a dict with information
        input_type = data["type"]
        if input_type == "init":
            args = data["envConfigs"]
            if args is None: args = {}
            env = PendulumEnv(**args)
            output(dict(env.metadata))
        elif input_type == "step":
            try:
                obs, reward, done, info = env.step(data)
            except AssertionError as err:
                exit()
            out = dict(obs=serialize_np(obs), reward=reward, done=done, info=info)
            output(out)
        elif input_type == "seed":
            seed = data["seed"]
            obs = env.seed(int(seed))
            output(obs)
        elif input_type == "reset":
            state = data["state"]
            obs = env.reset(state)
            out = dict(obs=(serialize_np(obs)))
            output(out)
        elif input_type == "register_agents":
            assert len(data['ids']) == 1
            output(dict(ids=["player_0"]))
        elif input_type == "close":
            exit()