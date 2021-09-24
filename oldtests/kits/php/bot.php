<?php
include(__DIR__ . "/kit.php");

$agent = new Agent();

$agent->initialize();

while(true) {
    print "R\n";
    
    $agent->end_turn();
    $agent->update();
}