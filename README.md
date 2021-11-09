# Dimensions

[![npm version](https://badge.fury.io/js/dimensions-ai.svg)](https://badge.fury.io/js/dimensions-ai)

This is an **open sourced** **generic** **Artificial Intelligence competition framework**, intended to provide you the fully scalable infrastructure needed to run your own AI competition with no hassle.

All you need to do?

Code an **environment** and code a **bot**

Dimensions handles the rest, including match and tournament running, security, and scalability.

The framework was built with the goals of being **generalizable** and **accessible**. That's why Dimensions utilizes an I/O based model to run competitions and pit AI agents against each other (or themselves!), allowing it to be generic and language agnostic so anyone from any background can compete in your environment.

Keep reading to learn how to [get started](#getting-started) and make a tournament like this:


## Features

TODO

## Tutorial? TODO name

Environments need to implement the following 

"step"

For single agent env, must be gym compliant

receive -> {"type": "step", "actions": action_schema | null}

env must also deal with when agent returns null

Environment should never raise an error. It should always expect well formed input of the above schema...

Multiagent

receive -> {"type": "step", "actions": { player_id: action_schema | null } }
send -> { player_id: {"obs": obs_schema, "reward": None | float, "info": None | dict} }

It should handle input such that if action provided is not quite correct (e.g. should be a array but got a string), then 

Single agent: print the error out and then exit

Multi agent: 
1. probably mark the the agent with the bad action is being done and auto loses or something
2. freeze that agent by marking it as done, other agents continue


Agents need to implement the following

"init"
receive -> {"type": "init", "id": string, "name": string}
output -> id

Tells the agent their id and given name

"action"
receive -> {"type": "action", "obs": observation (defined by schema)", "reward" : None | float, "info": None | dict}
output -> {"action": any}

"close"

## Development

To setup the repo and/or build from source, first using [conda]() to instantiate a new conda environment with all python requirements installed

```
conda create -f environment.yml
conda activate dimensions
```

Then install the JS/TS requirements

```
npm i
```

Run

```
npm test
```

to run all test suites

### Building

To build the package, run

```
npm run build
```