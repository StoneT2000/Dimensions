package kit;

import java.io.IOException;
import java.util.Scanner;

public class Agent {

    public int id;
    public int maxRounds;
    public Agent() {

    }

    public void initialize() {
        id = Input.readInput().getInt();
        maxRounds = Input.readInput().getInt();
    }

    public void update() {
      Input input = Input.readInput();
      String result = input.getString();
      input = Input.readInput();
      String lastOpponentMove = input.getString();
    }

    public void endTurn() {
        System.out.println("D_FINISH");
    }
}