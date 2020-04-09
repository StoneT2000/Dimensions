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
        init = read_input()

    """
    Updates Agent's own known state of `Match`
    User should edit this according to the `Design` this agent will compete under
    """
    def update(self):
        update = read_input()

    """
    End a 'turn'
    Effectively tells the `MatchEngine` to stop processing this agent's commands and mark this agent as finished for 
    the current timeStep
    """
    def end_turn(self):
        print('D_FINISH')
        
