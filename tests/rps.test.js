// const Dimension = require('dimensions-ai');
let Dimension = require('../src');
const MatchStatus = Dimension.MatchStatus;

/**
 * This rock paper scissors game lets 2 agents play a best of n rock paper scissors 
 */
class RockPaperScissorsDesign extends Dimension.Design{
  async initialize(match) {
    // This is the initialization step of the design, where you decide what to tell all the agents before they start
    // competing
    // You are given the match itself, and the configuration you passed in when running a match

    // let's create a state that persists through the entire match and can be updated in the update function
    let state = {
      maxRounds: match.configs.bestOf, // we will store the max rounds of rock paper scissors this game will run
      results: [], // we will also store the winner of each of those rounds by each agent's ID
      rounds: 0, // rounds passed so far
      failedAgent: null // the id of the agent that failed to play correctly
    }
    match.state = state; // this stores the state defined above into the match for re-use

    // Each match has a list of agents in match.agents, we can retrieve each of their IDs using agent.id
    // each agent ID is numbered from 0,... n-1 in a game of n agents. In this game, theres only two agents
    // agent0 and agent1
    for (let i = 0; i < 2; i++) {
      let agent = match.agents[i];

      // Here, we are sending each agent their own ID. This is a good practice for any AI competition design
      // The first arg is the message, the second arg is the id of the agent you want to send the message to
      // We use await to ensure that these ID messages are sent out first
      await match.send(`${agent.id}`, agent.id);
    }

    // we also want to send every agent the max number of rounds
    await match.sendAll(match.state.maxRounds);

    // This is initialization done!
  }
  async update(match, commands) {
    // This is the update step of the design, where all the run-time game logic goes
    // You are given the match itself, all the commands retrieved from the last round / time step from all agents, and
    // the original configuration you passed in when running a match.
    
    // if no commands, just return and skip update
    if (!commands.length) return;

    let winningAgent;

    // check which agents are still alive, if one timed out, the other wins. If both time out, it's a tie
    if (match.agents[0].isTerminated() && match.agents[1].isTerminated()) {
      match.state.terminated = {
        0: 'terminated',
        1: 'terminated'
      }
      match.state.terminatedResult = 'Tie'
      return MatchStatus.FINISHED;
    }
    else if (match.agents[0].isTerminated()) {
      match.state.terminated = {
        0: 'terminated'
      }
      match.state.terminatedResult = match.agents[1].name
      return MatchStatus.FINISHED;
    }
    else if (match.agents[1].isTerminated()) {
      match.state.terminated = {
        1: 'terminated'
      }
      match.state.terminatedResult = match.agents[0].name
      return MatchStatus.FINISHED;
    }

    // each command in commands is an object with an agentID field and a command field, containing the string the agent sent
    let agent0Command = null;
    let agent1Command = null;

    // there isn't a gurantee in the command order, so we need to loop over the commands and assign them correctly
    for (let i = 0; i < commands.length; i++) {
      if (commands[i].agentID === 0)  {
        agent0Command = commands[i].command;
        continue;
      }
      else if (commands[i].agentID === 1) {
        agent1Command = commands[i].command;
        continue;
      }

      // we also want to verify we received one command each from both players. If not, terminate the players at fault
      // We throw a MatchError through the match, indicating the agent at fault. 
      // This doesn't stop the whole process but logs the error or warning
      if (agent0Command != null && commands[i].agentID === 0) {
        // agent 0 already had a command sent, and tried to send another, so we store that agent0 is at fault 
        // and end the match
        match.throw(0, new Dimension.MatchError('attempted to send an additional command'));
        match.state.failedAgent = 0;
        return MatchStatus.FINISHED;
      }
      if (agent0Command != null && commands[i].agentID === 0) {
        // agent 1 already had a command sent, and tried to send another, so we store that agent 1 is at fault 
        // and end the match
        match.throw(0, new Dimension.MatchError('attempted to send an additional command'));
        match.state.failedAgent = 1;
        return MatchStatus.FINISHED;
      }
    }

    // We have that each agent will give us a command that is one of 'R', 'P', or 'S' indicating Rock, Paper, Scissors
    // if it isn't one of them, which doesn't stop the match but prints to console the error
    // we will end the match ourselves and set which agent failed
    let validChoices = new Set(['R', 'P', 'S']);
    if (!validChoices.has(agent0Command)) {
      match.throw(0, new Dimension.MatchError(agent0Command + ' is not a valid command!'));
      match.state.failedAgent = 0;
      return MatchStatus.FINISHED;
    }
    if (!validChoices.has(agent1Command)) {
      match.throw(0, new Dimension.MatchError(agent1Command + ' is not a valid command!'));
      match.state.failedAgent = 1;
      return MatchStatus.FINISHED;
    }

    // now we determine the winner, agent0 or agent1? or is it a tie?
    if (agent0Command === agent1Command) {
      // it's a tie if they are the same, so we set winningAgent = -1 as no one won!
      winningAgent = -1
    }
    else if (agent0Command === 'R') {
      if (agent1Command === 'P') {
        winningAgent = 1; // paper beats rock
      }
      else {
        winningAgent = 0;
      }
    }
    else if (agent0Command === 'P') {
      if (agent1Command === 'S') {
        winningAgent = 1; // scissors beats paper
      }
      else {
        winningAgent = 0;
      }
    }
    else if (agent0Command === 'S') {
      if (agent1Command === 'R') {
        winningAgent = 1; // rock beats scissors
      }
      else {
        winningAgent = 0;
      }
    }

    // update the match state
    match.state.results.push(winningAgent);
    // log the winner at the info level
    if (winningAgent != -1) {
      match.log.detail(`Round: ${match.state.rounds} - Agent ${winningAgent} won`);
    }
    else {
      match.log.info(`Tie`);
    }
    // we increment the round if it wasn't a tie
    if (winningAgent != -1) match.state.rounds++;

    // we send the status of this round to all agents
    match.sendAll(winningAgent);
    // we also want to tell the opposing agents what their opponents used last round
    match.send(agent1Command, 0);
    match.send(agent0Command, 1);

    // we now check the match status
    // if rounds reaches maxrounds, we return MatchStatus.FINISHED
    if (match.state.rounds === match.state.maxRounds) {
      return MatchStatus.FINISHED;
    }

    // not returning anything makes the engine assume the match is still running
  }
  async getResults(match) {
    // This is the final, result collection step occuring once the match ends
    let results = {
      scores: {
        0: 0,
        1: 0,
      },
      ties: 0,
      winner: '',
      terminated: {

      }
    }

    

    // we now go over the round results and evaluate them
    match.state.results.forEach((res) => {
      if (res !== -1) {
        // if it wasn't a tie result, update the score
        results.scores[res] += 1;
      }
      else {
        // otherwise add to ties count
        results.ties += 1;
      }
    });

    // we store what agents were terminated by timeout and get results depending on termination
    // and stop result evaluation
    if (match.state.terminated) {
      results.terminated = match.state.terminated;
      results.winner = match.state.terminatedResult;
      return results;
    }

    // determine the winner and store it
    if (results.scores[0] > results.scores[1]) {
      results.winner = match.agents[0].name;
    }
    else if (results.scores[0] < results.scores[1]) {
      results.winner = match.agents[1].name;
    }
    else {
      results.winner = 'Tie';
    }

    // if there was an agent that failed, then they lose. The winner is the other agent
    if (match.state.failedAgent != null) {
      let winningAgent = (match.state.failedAgent + 1) % 2;
      results.winner = match.agents[winningAgent].name;
    }
    
    // we have to now return the results 
    return results;
  }
}


describe('Rock Paper Scissors Run', () => {
  let RPSDesign, myDimension_line_count, RPSDesign_line_count;
  let myDimension;
  beforeAll(() => {
    RPSDesign = new RockPaperScissorsDesign('RPS!', {
      engineOptions: {
        timeout: {
          max: 500,
        }
      }
    });
    myDimension = Dimension.create(RPSDesign, {
      name: 'RPS',
      activateStation: false,
      observe: false,
      loggingLevel: Dimension.Logger.LEVEL.WARN
    });
    RPSDesign_line_count = new RockPaperScissorsDesign('RPS!', {
      engineOptions: {
        commandFinishPolicy: 'line_count'
      }
    });
    myDimension_line_count = Dimension.create(RPSDesign_line_count, {
      name: 'RPS_line_count',
      activateStation: false,
      observe: false,
      loggingLevel: Dimension.Logger.LEVEL.WARN
    });
  })
  test('Test line count based engine', async () => {
    expect.assertions(1);
    let results = await myDimension_line_count.runMatch(
      ['./tests/js-kit/rps/line_countbot.js', './tests/js-kit/rps/line_countbotpaper.js'],
      {
        name: 'line-count (0)',
        bestOf: 10
      }
    )
    // line count bot also sends extraneous output of 's': scissors, which should all be erased by matchengine
    // we test this by ensuring the score is correct, otherwise the extraneous output would make line count bot win
    // sometimes.
    expect(results.scores).toStrictEqual({'0': 0, '1': 10});
  })
  test('Test run rock vs paper 3 times and test erasure of output', async () => {
    expect.assertions(1);
    let results = await myDimension.runMatch(
      ['./tests/js-kit/rps/rock.js', './tests/js-kit/rps/paper.js'],
      {
        name: 'erasure of output (1)',
        bestOf: 100
      }
    )
    expect(results.scores).toStrictEqual({'0': 0, '1': 100});
  });
  test('Test multi-language support, run smarter bot against rock.py 5 times', async () => {
    expect.assertions(1);
    let results = await myDimension.runMatch(
      ['./tests/js-kit/rps/smarter.js', './tests/python-kit/rps/rock.py'],
      {
        name: 'mult-lang (2)',
        bestOf: 4,
        loggingLevel: Dimension.Logger.LEVEL.ERROR
      }
    )
    // smarter agent defaults to scissors round 1 and loses to rock, then chooses paper afterward due to rock last move
    expect(results.scores).toStrictEqual({'0': 3, '1': 1});
  });
  test('Test run smarter bot against paper 5 times and test erasure of output', async () => {
    expect.assertions(1);
    let results = await myDimension.runMatch(
      ['./tests/js-kit/rps/smarter.js', './tests/js-kit/rps/paper.js'],
      {
        name: 'erasure of output (3)',
        bestOf: 30
      }
    )
    // smarter agent defaults to scissors round 1 and loses to rock, then chooses paper afterward due to rock last move
    expect(results.scores).toStrictEqual({'0': 30, '1': 0});
  });

  test('Test RPS to log match errors', async () => {
    const logSpy = jest.spyOn(console, 'log');
    expect.assertions(1);
    await myDimension.runMatch(
      ['./tests/js-kit/rps/errorBot.js', './tests/js-kit/rps/paper.js'],
      {
        name: 'log match errors (4)',
        bestOf: 5,
        loggingLevel: Dimension.Logger.LEVEL.WARN
      }
    );
    expect(logSpy).toBeCalledTimes(1);
  });

  test('Test RPS with stopping', async () => {
    expect.assertions(3);
    let match = await myDimension.createMatch(
      ['./tests/js-kit/rps/smarter.js', './tests/js-kit/rps/paper.js'],
      {
        name: 'stop and resume (5)',
        bestOf: 1000,
        loggingLevel: Dimension.Logger.LEVEL.WARN
      }
    )
    let results = match.run();
    async function startStop(match) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (match.stop()) {
            
          } else {

          }
          
          setTimeout(() => {
            expect(match.matchStatus).toStrictEqual(MatchStatus.STOPPED);
            if (match.resume()) {
              
              resolve();
            } else {
              reject();
            }
            
          }, 100)
        }, 100)
      }, this)
    }
    
    await startStop(match);
    expect(match.matchStatus).toStrictEqual(MatchStatus.RUNNING);
    await results.then((res) => {
      expect(res.scores).toStrictEqual({'0': 1000, '1': 0});
      console.log(res.scores);
    });
  });

  describe('Testing timeout mechanism', () => {
    test('Test timeout mechanism and auto giving non terminated bot the win', async () => {
      let res = await myDimension.runMatch(
        ['./tests/js-kit/rps/paper.js', './tests/js-kit/rps/delaybotrock.js'],
        {
          bestOf: 5,
          loggingLevel: Dimension.Logger.LEVEL.ERROR
        }
      );
      expect(res.terminated[1]).toBe('terminated');
      expect(res.winner).toBe('agent_0');
    });
    test('Test timeout mechanism, both timeout', async () => {
      let res = await myDimension.runMatch(
        ['./tests/js-kit/rps/delaybotrock.js', './tests/js-kit/rps/delaybotrock.js'],
        {
          bestOf: 5,
          loggingLevel: Dimension.Logger.LEVEL.ERROR
        }
      );
      expect(res.terminated[1]).toBe('terminated');
      expect(res.terminated[0]).toBe('terminated');
      expect(res.winner).toBe('Tie');
    });
    test('Test overriding timeout mechanism', async () => {
      let res = await myDimension.runMatch(
        ['./tests/js-kit/rps/delaybotpaper.js', './tests/js-kit/rps/delaybotrock.js'],
        {
          bestOf: 3,
          loggingLevel: Dimension.Logger.LEVEL.ERROR,
          engineOptions: {
            timeout: {
              active: false
            }
          }
        }
      );
      // expect(res.terminated[1]).toBe('terminated');
      // expect(res.terminated[0]).toBe('terminated');
      expect(res.winner).toBe('agent_0');
    });
  });
})

