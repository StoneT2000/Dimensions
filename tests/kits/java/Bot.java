import kit.*;
public class Bot {
    public static void main(final String[] args) throws Exception {
        Agent agent = new Agent();
        agent.initialize();
        while(true) {
            System.out.println("R");
            agent.endTurn();
            agent.update();
        }
    }
}
