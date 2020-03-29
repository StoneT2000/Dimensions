# Dimensions

This is an **open sourced** **generic** **Artificial Intelligence competition framework**, intended to provide you all the infrastructure needed to run your own AI competition with no hassle.

All you need to do?

Code a competition design and code an Artificial Intelligence Agent

Dimensions handles the rest

Dimensions utilizes an I/O based model to run competitions and pit AI agents against each other, allowing it to be generic and fairly language agnostic.

This was inspired by Battlecode and Halite

## Getting Started

At the moment, Dimensions supports competition designing through JavaScript / TypeScript only. However, all AI agents can be coded in any language due to the I/O model.

First, install the `Dimensions` package

```
npm install dimensions-ai
```

Create a new file called `run.js` and inside it we need to first `require` the package

```js
const Dimension = require('dimensions-ai');
```

In order to start writing AI to compete against each other in a competition, you need to do two thing.

1. Design the competition
2. Design an AI starter kit

Let's first design a simple RockPaperScissors competition. To design a competition, you will need to code. In the future, there will be options to create a competition design without any code at all.

The general framework is to create a class that extends `Dimension.Design`. Let's call this design `RockPaperScissorsDesign`

So now we would have something like

```js
class RockPaperScissorsDesign extend Dimension.Design {

}
```





To start, first we create a new `Design`. The `Design` class is what controls all of the competition run-time logic and how the participating `Agents` should interact and compete. You will need to create a class that extends `Dimension.Design`

## Development

This is all written in [TypeScript](https://www.typescriptlang.org/)

First install all necessary packages with

```
npm install
```

Start development by running

```
npm run watch
```

to watch for code changes and reload the build folder

Start testing by running 

```
npm run test-watch
```

to constantly test as you develop. Tests are written using [Jest](jestjs.io/)

## Road Map / Plans