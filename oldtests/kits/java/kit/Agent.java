package kit;

import java.io.IOException;
import java.util.Scanner;

public class Agent {
    public Scanner sc = new Scanner(System.in);
    public int id;
    public int maxRounds;
    public Agent() {

    }

    public void initialize() {
        
        id = sc.nextInt();
        maxRounds = sc.nextInt();
    }

    public void update() {
      String result = sc.nextLine();
      String lastOpponentMove = sc.nextLine();
    }

    public void endTurn() {
        System.out.println("D_FINISH");
    }
}