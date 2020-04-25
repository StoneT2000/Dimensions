import random


# This is an example bot written by the developers!
# Use this to help write your own code, or run it against your bot to see how well you can do!

DEBUG = 0
def dlog(str):
    if DEBUG > 0:
        log(str)


def check_space_wrapper(r, c, board_size):
    # check space, except doesn't hit you with game errors
    if r < 0 or c < 0 or c >= board_size or r >= board_size:
        return False
    try:
        return check_space(r, c)
    except:
        return None

def turn():
    """
    MUST be defined for robot to run
    This function will be called at the beginning of every turn and should contain the bulk of your robot commands
    """
    board_size = get_board_size()

    team = get_team()
    opp_team = Team.WHITE if team == Team.BLACK else team.BLACK

    robottype = get_type()

    if robottype == RobotType.PAWN:
        row, col = get_location()

        if team == Team.WHITE:
            forward = 1
        else:
            forward = -1

        # try catpuring pieces
        if check_space_wrapper(row + forward, col + 1, board_size) == opp_team: # up and right
            capture(row + forward, col + 1)

        elif check_space_wrapper(row + forward, col - 1, board_size) == opp_team: # up and left
            capture(row + forward, col - 1)

        # otherwise try to move forward
        elif row + forward != -1 and row + forward != board_size and not check_space_wrapper(row + forward, col, board_size):
            #               ^  not off the board    ^            and    ^ directly forward is empty
            move_forward()

        confusion = "you need a line here to avoid segfault. we aren't sure why but are working on it"
        # ^ I think this is related to the potential ambiguity of what the following else is referring to?

    else:
        if team == Team.WHITE:
            index = 0
        else:
            index = board_size - 1

        for _ in range(board_size):
            i = random.randint(0, board_size - 1)
            if not check_space(index, i):
                spawn(index, i)
                break

    bytecode = get_bytecode()

