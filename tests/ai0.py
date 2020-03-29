import sys

print("AI 0 Called! (PY)")

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
    """
    def initialize(self):
        pass
    """
    Updates Agent's own known state of `Match`
    """
    def update(self):
        pass