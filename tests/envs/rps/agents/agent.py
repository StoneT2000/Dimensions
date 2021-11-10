#!/usr/bin/env python3

import sys
import json
import numpy as np
if __name__ == "__main__":
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

    agent_id = None
    player_id = None
    agent_name = None
    while (True):
        inputs = read_input()
        data = json.loads(inputs) # load into a dict with information
        input_type = data["type"]
        if input_type == "init":
            agent_id = data["id"]
            agent_name = data["name"]
            output(dict(id=agent_id))
            # {"type": "init", "name": "abc", "id": 3}
        elif input_type == "action":
            if 'reward' not in data:
                # then this is a new episode!
                pass
            obs = np.array(data['obs'])
            output(dict(
                action=0
            ))
        elif input_type == "close":
            # do any kind of clean up you want to do
            exit()