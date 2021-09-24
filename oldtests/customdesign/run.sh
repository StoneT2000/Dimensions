#!/bin/bash

# fake game that gives player 1 20 points, player 2 10 points automatically
sleep 0.5 # pretending to run complex computations
>&2 echo "error"
sleep 0.2
echo D_MATCH_FINISHED
echo 20
echo 10