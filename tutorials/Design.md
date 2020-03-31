# Dimension.Design

This is in depth documentation of the `Dimension.Design` class and how to create your own competition design with it and use it

## Creating a Design

First, think of a competiton idea. This can be as simple as Rock Paper Scissors (which we use as an example) to something as complex as [Battlecode](https://battlecode.org) or [Chess](https://en.wikipedia.org/wiki/Chess)

Now, let's code it

To create a `design`, you must extend the `Dimension.Design` class and implement 3 key lifecycle functions.

| Design Lifecycle Functions | Purpose                                        |
| -------------------------- | ---------------------------------------------- |
| `initialize`               | Perform match initializations                  |
| `update`                   | Update the match state and return match status |
| `getResults`               | Return the match results                       |

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

