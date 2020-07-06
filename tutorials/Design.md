# Creating a Design

First, think of a competiton idea. This can be as simple as Rock Paper Scissors (which we use as an example) to something as complex as [Battlecode](https://battlecode.org) or [Chess](https://en.wikipedia.org/wiki/Chess)

Now, let's code it

To create a `design`, you must extend the `Dimension.Design` class and implement 3 key lifecycle functions.

| Design Lifecycle Functions | Purpose                                        |
| -------------------------- | ---------------------------------------------- |
| `initialize`               | Perform match initializations                  |
| `update`                   | Update the match state and return match status |
| `getResults`               | Return the match results                       |

More details found on the documentation [here](https://stonet2000.github.io/Dimensions/classes/_design_index_.design.html)

So now we would have something like


```js
class RockPaperScissorsDesign extend Dimension.Design {
  async initialize(match) {
    ...
  }
  async update(match, commands) {
    ...
  }
  async getResults(match) {
    ...
  }
}
```

Now, what's available to you for use is `match` and `commands`

Each `match` parameter passed in is of type [`Match`](https://stonet2000.github.io/Dimensions/classes/_match_index_.match.html) and is the same `match` that each lifecycle function works with. A `match` exposes key properties and functions for use to design the competition. The most important properties are `match.agents, match.state, match.configs` and important functions are `match.send, match.sendAll`. All documented [here](https://stonet2000.github.io/Dimensions/classes/_match_index_.match.html).

`match.agents` contains all the participating players, named as `agents`, all of type [`Agent`](https://stonet2000.github.io/Dimensions/classes/_agent_index_.agent.html). Each agent has fields such as `agent.id` and `agent.name`, useful for designing a competition when trying to decide what to communicate with agents in a competition. For example, in rock paper scissors, usually theres only 2 agents. Note that agents are numbered from 0, 1, 2... and so forth.

`match.state` is a property that accessible through the `match` input parameter of all 3 lifecycle functions, and can be used to store any information that should be retained or use throughout the match. This could be results of past rounds in a best of 3 rock paper scissors game.

`match.configs` is the same argument you pass in when running a `Match`, `Tournament` etc. You can send in same configurations such as how many rounds of rock paper scissors will be played.

`match.send(message, agentID or Agent)` sends a string `message` to the `agent` specified or the agent specified by its `agentID`. `match.sendAll(message)` sends the same message to all agents.

The `commands` parameter is an array of commands objects of the form `{command: string, agentID: number}`

Each command holds a command string, which is essentially something that was logged to output from one of the agents. For example, if an agent with ID `0` did `print('P')` in python or `console.log('P')` in javascript, the match engine will pick this up and populate `commands` with the array item `{command: 'P', agentID: 0}`

There are some requirements for these lifecycle functions:

For `initialize`, nothing needs to be returned. It is typically used to send some initial information to agents.

For `update`, a match status should be returned. If you don't return anything, the engine assumes the match is still running. If you return `Match.Status.FINISHED`, the engine will conclude the match and stop it.

For `getResults`, it must return or resolve a value, could be a number, an object, etc. representing the game results.

```js
const Match = Dimension.Match;
class RockPaperScissorsDesign extend Dimension.Design {
  async initialize(match) {
    ... // often communicate to agents via match.send about configurations and state
  }
  async update(match, commands) {
    ... // update match state with the commands
    ... // send information back to agents via match.send to communicate anything
    // suppose we reached the max rounds of rock paper scissors
    if (match.state.rounds === match.state.maxRounds) {
      // we return this to end the match
      return Match.Status.FINISHED;
    }
  }
  async getResults(match) {
    let results = {}
    ... // determine results
    return results; // return them
  }
}
```

An example of a rock paper scissors competition design can be found [here](https://github.com/StoneT2000/Dimensions/blob/master/examples/rock-paper-scissors/rps.js)

Some existing `designs` are provided as examples at [/examples](https://github.com/StoneT2000/Dimensions/blob/master/examples/), which currently includes Rock Paper Scissors (RPS). A more advanced Halite 3 design using this framework has also been made and can be found [here](https://github.com/StoneT2000/dimensions-halite3). An hide and seek design was used in the an [AI competition at UCSD](https://github.com/acmucsd/hide-and-seek-ai).

If you want to kick start development on your own `design`, check out [/templates/designs](https://github.com/StoneT2000/Dimensions/tree/master/templates/designs)

Look into the documentation on [Match](https://stonet2000.github.io/Dimensions/classes/_match_index_.match.html) and [Agent](https://stonet2000.github.io/Dimensions/classes/_agent_index_.agent.html) for what data is available to you to use in your design.

The next step of designing a competition involves designing a starter kit. Click [here]() for a tutorial on that!