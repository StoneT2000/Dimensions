package kit;

import java.util.Scanner;

public class Agent {
    public Scanner scanner;
    public int id;
    public int maxRounds;
    public Agent() {
      scanner = new Scanner(System.in);
    }

    public void initialize() {
        id = scanner.nextInt();
        maxRounds = scanner.nextInt();
    }

    public void update() {
      String result = scanner.nextLine();
      String lastOpponentMove = scanner.nextLine();
    }

    public void endTurn() {
        System.out.println("D_FINISH");
        System.out.flush();
    }
}