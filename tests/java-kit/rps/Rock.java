import kit.*;
public class Rock {
    public static void main(final String[] args) throws Exception {
        Input input = Input.readInput();
        int agentID = input.getInt();
        input = Input.readInput();
        int maxRounds = input.getInt();

        while(true) {
            System.out.println("R");
            System.out.println("D_FINISH");
            Input turnInput = Input.readInput();
            int result = turnInput.getInt();
            turnInput = Input.readInput();
            String str = turnInput.getStr();
        }
    }
}
