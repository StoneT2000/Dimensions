#include <stdio.h>
#include <stdlib.h>
struct Agent {
    int id;
    int max_rounds;
};
struct Agent * agent;
void agent_initialize() {
    agent = (struct Agent *) malloc(sizeof(struct Agent));
    int id;
    int max_rounds;
    fscanf(stdin, "%d", &id);
    fscanf(stdin, "%d", &max_rounds);
    agent->id = id;
    agent->max_rounds = max_rounds;
}

void agent_end_turn() {
    printf("D_FINISH\n");
    // flush it all out
    fflush(stdout);
}
void agent_update() {
    int result;
    char lastOpponentMove;
    fscanf(stdin, "%d", &result);
    fscanf(stdin, "%s", &lastOpponentMove);
}
