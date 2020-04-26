import time
import argparse
import faulthandler
import sys
import threading

# sys.path.insert(1, 'battlehack20/engine');
from battlehack20 import CodeContainer, Game, BasicViewer, GameConstants

"""
This is a simple script for running bots and debugging them.

Feel free to change this script to suit your needs!

Usage:

    python3 run.py examplefuncsplayer examplefuncsplayer

        Runs examplefuncsplayer against itself. (You can omit the second argument if you want to.)

    python3 -i run.py examplefuncsplayer examplefuncsplayer

        Launches an interactive shell where you can step through the game using step().
        This is great for debugging.
    
    python3 -i run.py examplefuncsplayer exampelfuncsplayer --debug false

        Runs the script without printing logs. Instead shows the viewer in real time.

    python3 run.py -h

        Shows a help message with more advanced options.
"""


def step(number_of_turns=1):
    """
    This function steps through the game the specified number of turns.

    It prints the state of the game after every turn.
    """

    for i in range(number_of_turns):
        if not game.running:
            print(f'{game.winner} has won!')
            break
        game.turn()
        viewer.view()


def play_all(delay=0.8, keep_history=False, real_time=False):
    """
    This function plays the entire game, and views it in a nice animated way.

    If played in real time, make sure that the game does not print anything.
    """

    if real_time:
        viewer_poison_pill = threading.Event()
        viewer_thread = threading.Thread(target=viewer.play_synchronized, args=(viewer_poison_pill,), kwargs={'delay': delay, 'keep_history': keep_history})
        viewer_thread.daemon = True
        viewer_thread.start()

    while True:
        if not game.running:
            break
        game.turn()

    if real_time:
        viewer_poison_pill.set()
        viewer_thread.join()
    else:
        viewer.play(delay=delay, keep_history=keep_history)

    print(f'{game.winner} wins!')



if __name__ == '__main__':

    # This is just for parsing the input to the script. Not important.
    parser = argparse.ArgumentParser()
    parser.add_argument('player', nargs='+', help="Path to a folder containing a bot.py file.")
    parser.add_argument('--raw-text', action='store_true', help="Makes playback text-only by disabling colors and cursor movements.")
    parser.add_argument('--delay', default=0.8, help="Playback delay in seconds.")
    parser.add_argument('--debug', default='true', choices=('true','false'), help="In debug mode (defaults to true), bot logs and additional information are displayed.")
    parser.add_argument('--max-rounds', default=GameConstants.MAX_ROUNDS, type=int, help="Override the max number of rounds for faster games.")
    parser.add_argument('--board-size', default=GameConstants.BOARD_SIZE, type=int, help="Override the board size for faster games.")
    parser.add_argument('--seed', default=GameConstants.DEFAULT_SEED, type=int, help="Override the seed used for random.")
    args = parser.parse_args()
    args.debug = args.debug == 'true'

    # The faulthandler makes certain errors (segfaults) have nicer stacktraces.
    faulthandler.enable() 

    # This is where the interesting things start!

    # Every game needs 2 code containers with each team's bot code.
    code_container1 = CodeContainer.from_directory(args.player[0])
    code_container2 = CodeContainer.from_directory(args.player[1] if len(args.player) > 1 else args.player[0])

    # This is how you initialize a game,
    game = Game([code_container1, code_container2], board_size=args.board_size, max_rounds=args.max_rounds, 
                seed=args.seed, debug=args.debug, colored_logs=not args.raw_text)
    
    # ... and the viewer.
    viewer = BasicViewer(args.board_size, game.board_states, colors=not args.raw_text)


    # Here we check if the script is run using the -i flag.
    # If it is not, then we simply play the entire game.
    if not sys.flags.interactive:
        play_all(delay = float(args.delay), keep_history = args.raw_text, real_time = not args.debug)

    else:
        # print out help message!
        print("Run step() to step through the game.")
        print("You also have access to the variables: game, viewer")

