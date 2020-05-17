#!/bin/bash
w=$1
b=$2
seed=$3
replay_name=$4
board_size=$5
max_rounds=$6
wname=$7
bname=$8
replay_path="replays/${replay_name}.txt"
echo Team 1: $w > $replay_path
echo Team 2: $b >> $replay_path
echo Battlehack Version: Name: battlehack20 >> $replay_path
echo Version: 1.1.0 >> $replay_path
echo Summary: Battlehack 2020 game engine. >> $replay_path
echo Home-page: https://bh2020.battlecode.org >> $replay_path
echo Author: Battlecode >> $replay_path
echo Author-email: battlecode@mit.edu >> $replay_path
echo License: GNU General Public License v3.0 >> $replay_path
echo Location: /usr/local/lib/python3.7/site-packages >> $replay_path
echo Requires: RestrictedPython >> $replay_path
echo Required-by:  >> $replay_path


python3 ./tests/bh20files/run_game.py $w $b --seed $seed --delay 0 --raw-text --board-size $board_size --max-rounds $max_rounds >> $replay_path
echo D_MATCH_FINISHED
WINNER=`awk '/./{line=$0} END{print line}' $replay_path`
echo $WINNER
if [[ $WINNER == 'Team.WHITE wins!' ]]; then
  echo $wname
  echo $bname
else
  echo $bname
  echo $wname
fi