import kit.*;
public class Rock {
    public static void main(final String[] args) throws Exception {
        Agent agent = new Agent();
        
        while(true) {
            System.out.println("R");
            // System.out.println("R");
            // System.out.println("R");
            agent.endTurn();
            agent.update();
        }
    }
}
