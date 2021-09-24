
#include "kit.hpp"
#include <string>

int main() {
  kit::Agent agent = kit::Agent();
  // initialize
  agent.initialize();

  while(true) {
    // play rock
    std::cout << 'R' << std::endl;
    // end turn
    agent.end_turn();
    // wait for updates
    agent.update();
  }
  
  return 0;
}