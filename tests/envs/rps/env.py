from gym.spaces import Discrete
import numpy as np
from pettingzoo import AECEnv
from pettingzoo.utils import agent_selector
from pettingzoo.utils import wrappers
from pettingzoo.utils.conversions import parallel_wrapper_fn
import os

def env(**kwargs):
    env = raw_env(**kwargs)
    env = wrappers.AssertOutOfBoundsWrapper(env)
    env = wrappers.OrderEnforcingWrapper(env)
    return env


parallel_env = parallel_wrapper_fn(env)


class raw_env(AECEnv):
    """Two-player environment for rock paper scissors.
    Expandable environment to rock paper scissors lizard spock action_6 action_7 ...
    The observation is simply the last opponent action."""

    metadata = {'render.modes': ['human', 'rgb_array'], "name": "rps_v2"}

    def __init__(self, num_actions=3, max_cycles=15):
        self.max_cycles = max_cycles

        # number of actions must be odd and greater than 3
        assert num_actions > 2, "The number of actions must be equal or greater than 3."
        assert num_actions % 2 != 0, "The number of actions must be an odd number."
        self._moves = ["ROCK", "PAPER", "SCISSORS"]
        if num_actions > 3:
            # expand to lizard, spock for first extra action pair
            self._moves.extend(("SPOCK", "LIZARD"))
            for action in range(num_actions - 5):
                self._moves.append("ACTION_"f'{action + 6}')
        # none is last possible action, to satisfy discrete action space
        self._moves.append("None")
        self._none = num_actions

        self.agents = ["player_" + str(r) for r in range(2)]
        self.possible_agents = self.agents[:]
        self.agent_name_mapping = dict(zip(self.agents, list(range(self.num_agents))))
        self.action_spaces = {agent: Discrete(num_actions) for agent in self.agents}
        self.observation_spaces = {agent: Discrete(1 + num_actions) for agent in self.agents}

        self.screen = None
        self.history = [0] * (2 * 5)

        self.reinit()

    def reinit(self):
        self.agents = self.possible_agents[:]
        self._agent_selector = agent_selector(self.agents)
        self.agent_selection = self._agent_selector.next()
        self.rewards = {agent: 0 for agent in self.agents}
        self._cumulative_rewards = {agent: 0 for agent in self.agents}
        self.dones = {agent: False for agent in self.agents}
        self.infos = {agent: {} for agent in self.agents}

        self.state = {agent: self._none for agent in self.agents}
        self.observations = {agent: self._none for agent in self.agents}

        self.num_moves = 0

    def render(self, mode="human"):
        return self.state
    def observe(self, agent):
        # observation of one agent is the previous state of the other
        return np.array(self.observations[agent])

    def close(self):
        pass

    def reset(self, state=None):
        self.reinit()
        return self.state

    def step(self, action):
        if self.dones[self.agent_selection]:
            return self._was_done_step(action)
        agent = self.agent_selection

        self.state[self.agent_selection] = action

        # collect reward if it is the last agent to act
        if self._agent_selector.is_last():

            # same action => 0 reward each agent
            if self.state[self.agents[0]] == self.state[self.agents[1]]:
                rewards = (0, 0)
            else:
                # same action parity => lower action number wins
                if (self.state[self.agents[0]] + self.state[self.agents[1]]) % 2 == 0:
                    if self.state[self.agents[0]] > self.state[self.agents[1]]:
                        rewards = (-1, 1)
                    else:
                        rewards = (1, -1)
                # different action parity => higher action number wins
                else:
                    if self.state[self.agents[0]] > self.state[self.agents[1]]:
                        rewards = (1, -1)
                    else:
                        rewards = (-1, 1)
            self.rewards[self.agents[0]], self.rewards[self.agents[1]] = rewards

            self.num_moves += 1

            self.dones = {agent: self.num_moves >= self.max_cycles for agent in self.agents}

            # observe the current state
            for i in self.agents:
                self.observations[i] = self.state[self.agents[1 - self.agent_name_mapping[i]]]
        else:
            self.state[self.agents[1 - self.agent_name_mapping[agent]]] = self._none

            self._clear_rewards()

        self._cumulative_rewards[self.agent_selection] = 0
        self.agent_selection = self._agent_selector.next()
        self._accumulate_rewards()

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
    def serialize_ma_obs(dict_obs):
        return {agent: serialize_np(dict_obs[agent]) for agent in dict_obs}
    def serialize_ma_raw(dict_obs):
        return {agent: dict_obs[agent] for agent in dict_obs}

    env: raw_env = None
    agent_id_to_player_id = {}
    while (True):
        inputs = read_input()
        data = json.loads(inputs) # load into a dict with information
        input_type = data["type"]

        if input_type == "init":
            args = data["envConfigs"]
            if args is None: args = {}
            env = parallel_env(**args)
            output(env.metadata)
        elif input_type == "step":
            observations, rewards, dones, infos = env.step(data['actions'])
            serialized = dict(observations=serialize_ma_obs(observations), rewards=serialize_ma_raw(rewards), dones=serialize_ma_raw(dones), infos=serialize_ma_raw(infos))
            out = dict()
            for k in observations.keys():
                obs = serialized['observations'][k]
                reward = serialized['rewards'][k]
                done = serialized['dones'][k]
                info = serialized['infos'][k]
                out[k] = dict(obs=obs,reward=reward,done=done,info=info, player_id=k)
            output(out)
        elif input_type == "reset":
            state = data["state"]
            observations = env.reset()
            out = dict()
            serialized = dict(observations=serialize_ma_obs(observations))
            for k in observations.keys():
                obs = serialized['observations'][k]
                out[k] = dict(obs=obs)
            output(out)
        elif input_type == "seed":
            seed = data["seed"]
            obs = env.seed(int(seed))
            output(obs)
        elif input_type == "register_agents":
            # can only register at the start, expect all agent ids first. Input here should not require validation
            ids = data['ids']
            assert len(ids) == 2
            output(dict(ids=["player_0", "player_1"]))
        elif input_type == "close":
            exit()