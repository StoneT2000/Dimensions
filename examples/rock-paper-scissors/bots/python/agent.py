import sys

def read_input():
    """
    Reads input from stdin, shutting down logging and exiting if an EOFError occurs
    :return: input read
    """
    try:
        return input()
    except EOFError as eof:
        raise SystemExit(eof)
      
class AgentController:
    def __init__(self):
        pass

    """
    Initialize Agent for the `Match`
    User should edit this according to the `Design` this agent will compete under
    """
    def initialize(self):
        myAgentID = int(read_input())
        self.id = myAgentID;

        maxRounds = int(read_input())
        self.maxRounds = maxRounds;
        # Let's also store the opponents moves and the results of each round after each round
        self.pastOpponentMoves = [];
        self.roundResults = [];

    """
    Updates Agent's own known state of `Match`
    User should edit this according to the `Design` this agent will compete under
    """
    def update(self):
        # wait for the engine to send the result of the last round, which is the ID of the agent who won
        result = int(read_input())
        self.roundResults.append(result);

        # wait for the engine to send you the opponent's last move, which is either 'R', 'P', or 'S'
        lastOpponentMove = (read_input())
        self.pastOpponentMoves.append(lastOpponentMove);

    """
    End a 'turn'
    Effectively tells the `MatchEngine` to stop processing this agent's commands and mark this agent as finished for 
    the current timeStep
    """
    def end_turn(self):
        print('D_FINISH')
        
