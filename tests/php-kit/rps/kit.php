<?php
class Agent {
    public $id;
    function  __construct () {

    }

    function initialize() {
        fscanf(STDIN, "%d\n", $id);
        fscanf(STDIN, "%d\n", $max_rounds);
    }
    function update() {
        fscanf(STDIN, "%s\n", $result);
        fscanf(STDIN, "%s\n", $opponentmove);
    }
    function end_turn() {
        print "D_FINISH\n";
        flush();
    }
}