#!/usr/bin/env python3

import sys
import json
import numpy as np


def read_input():
    try:
        return input()
    except EOFError as eof:
        raise SystemExit(eof)


def output(data):
    json.dump(data, sys.stdout)
    sys.stdout.write("\n")


def serialize_np(arr):
    return arr.tolist()


class Agent:
    def __init__(self, meta=dict()) -> None:
        self.meta = meta

    def act(obs):
        """
        Produce an action given this observation
        """
        return 1


if __name__ == "__main__":

    agent = Agent()
    while True:
        inputs = read_input()
        data = json.loads(inputs)  # load into a dict with information
        input_type = data["type"]
        if input_type == "init":
            agent.meta["id"], agent.meta["name"] = data["id"], data["name"]
            output(dict(id=agent.meta["id"]))
        elif input_type == "action":
            if "reward" not in data:
                # then this is a new episode!
                pass
            obs = np.array(data["obs"])
            output(dict(action=agent.act(obs)))
        elif input_type == "close":
            # do any kind of clean up you want to do
            exit()
