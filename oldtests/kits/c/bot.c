
#include "kit.h"
#include <stdio.h>

int main() {
  // initialize
  agent_initialize();
  // we have agent of type Agent * available now
  while(1) {
    // play rock
    fprintf(stdout, "R\n");
    // end turn
    agent_end_turn();
    // wait for updates
    agent_update();
  }
  
  return 0;
}