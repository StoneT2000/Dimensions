
#include "kit.h"
#include <stdio.h>

int main() {
  // initialize
  agent_initialize();

  while(1) {
    // play rock
    printf("some command, my other command\n");
    // end turn
    agent_end_turn();
    // wait for updates
    agent_update();
  }
  
  return 0;
}