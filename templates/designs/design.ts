import * as Dimension from 'dimensions-ai';
import Match = Dimension.Match;
import Tournament = Dimension.Tournament;

interface MyMatchResults {
  ranks: Array<{ rank: number; agentID: number }>;
}

export class MyDesign extends Dimension.Design {
  constructor(name: string) {
    super(name);
  }

  // Initialization step of each match
  async initialize(match: Match): Promise<void> {
    // configure some state
    const state = {};
    // store the state into the match so it can be used again in `update` and `getResults`
    match.state = state;

    // a good design is to send each agent their ID to tell them the match is starting
    for (let i = 0; i < match.agents.length; i++) {
      const agentID = match.agents[i].id;
      // sends the string `${agentID}` to the agent specified by agentID
      match.send(`${agentID}`, agentID);
    }

    // also would be good to send any global information to all agents
    match.sendAll('initial information');
  }

  // Update step of each match, called whenever the match moves forward by a single unit in time (1 timeStep)
  async update(
    match: Match,
    commands: Array<Dimension.MatchEngine.Command>
  ): Promise<Match.Status> {
    // match.log is the logging tool to print to console during a match
    // infobar logs a bar for seperation
    match.log.infobar();
    // logs at the INFO level, depending on logging level set by the dimension and overidden by match settings
    match.log.info('Info for this time step');

    // loop over commands and handle them
    for (let i = 0; i < commands.length; i++) {
      // get the command and the agent that issued it and handle appropriately
      const command = commands[i].command;
      const agentID = commands[i].agentID;

      const incorrectBehavior = false;
      if (incorrectBehavior) {
        // if there's incorrect behavior from an agent that is not fatal, you can log a match error for an agent
        match.throw(agentID, new Dimension.MatchWarn('Incorrect behavior'));
      }
      const fatalError = false;
      if (fatalError) {
        // if there is something fatal that could break a match, you can log a fatal error for an agent
        match.throw(agentID, new Dimension.FatalError('Fatal error!!!!'));
      }
    }

    // send all agents relevant update information
    match.sendAll('update information');

    // send specific agents some information
    for (let i = 0; i < match.agents.length; i++) {
      const agent = match.agents[i];
      match.send('agentspecific', agent);
    }

    const matchOver = true;

    if (matchOver) {
      // if match is over, return finished
      return Match.Status.FINISHED;
    }
    // otherwise no need to return and match continues
  }

  // Result calculation of concluded match. Should return the results of a match after it finishes
  async getResults(match: Match): Promise<MyMatchResults> {
    // calculate results
    const results = {
      ranks: [
        { rank: 1, agentID: 0 },
        { rank: 2, agentID: 2 },
        { rank: 3, agentID: 1 },
      ],
    };

    // return them
    return results;
  }

  // It's recommended to write result handlers for the different rank systems so that people using the design
  // can run tournaments with it

  // result handler for RankSystem.WINS
  static winsResultHandler(
    results: MyMatchResults
  ): Tournament.RankSystem.WINS.Results {
    const winners = [];
    const ties = [];
    const losers = [];
    // push the numerical agent ids of the winners, tied players, and losers into the arrays and return them
    return {
      winners: winners,
      ties: ties,
      losers: losers,
    };
  }

  // result handler for RankSystem.TRUESKILL
  static trueskillResultHandler(
    results: MyMatchResults
  ): Tournament.RankSystem.TRUESKILL.Results {
    const rankings = [];
    for (let i = 0; i < results.ranks.length; i++) {
      const info = results.ranks[i];
      rankings.push({ rank: info.rank, agentID: info.agentID });
    }
    return { ranks: rankings };
  }
}
