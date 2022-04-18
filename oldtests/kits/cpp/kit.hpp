#include <string>
#include <iostream>
using namespace std; 
namespace kit {

    static string getline() {
        string line;
        getline(std::cin, line);

        // exit if stdin is bad now
        if (!std::cin.good()) exit(0);

        // return the line
        return line;
    }
    

    class Agent {
        public:
        int id;
        int max_rounds;
        Agent() {

        }
        /**
         * Initialize Agent for the `Match`
         * User should edit this according to their `Design`
         */
        void initialize() {
            id = stoi(kit::getline());
            max_rounds = stoi(kit::getline());
        }
        // end a turn
        static void end_turn() {
            cout << "D_FINISH" << std::endl;
        }

        /**
         * Updates agent's own known state of `Match`.
         */
        static void update() {
            int result = stoi(kit::getline());

            string lastOpponentMove = kit::getline();
        }
    };
    
}

