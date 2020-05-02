package kit;

import java.io.IOException;
import java.util.Scanner;

public class Agent {
    public Scanner scanner;
    public int id;
    public int maxRounds;
    public Agent() {
      scanner = new Scanner(System.in, "UTF-8");
    }

    public void initialize() {
        id = scanner.nextInt();
        maxRounds = scanner.nextInt();
    }

    public void update() {
      Input input = Input.readInput();
      String result = input.getString();
      input = Input.readInput();
      String lastOpponentMove = input.getString();
      System.err.print(result);
      System.err.print(lastOpponentMove);
    }

    public void endTurn() {
        System.out.println("D_FINISH");
    }
}