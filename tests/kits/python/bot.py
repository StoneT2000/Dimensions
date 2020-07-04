from kit import Agent
import sys
# Create new agent
agent = Agent()

# initialize agent
agent.initialize()

# print("HEY!", file=sys.stderr)
# Once initialized, we enter an infinite loop
while True:

    commands = []

    # AI Code goes here #

    # push some commands in to be processed by the `MatchEngine` working under a `Design`
    commands.append('R')

    # submit commands to the `MatchEngine` and the `Match`, using ',' as the delimiter
    print(','.join(commands))

    # now we end our turn
    agent.end_turn()


    # wait for update from match engine
    agent.update()