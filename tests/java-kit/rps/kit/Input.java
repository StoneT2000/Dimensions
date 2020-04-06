package kit;

public class Input {
    private final String[] input;
    private int current;

    public Input(final String line) {
        input = line.split(" ");
    }

    public int getInt() {
        return Integer.parseInt(input[current++]);
    }

    public String getStr() {
      return input[current++];
    }

    public static Input readInput() {
        return new Input(readLine());
    }

    public static String readLine() {
        try {
            final StringBuilder builder = new StringBuilder();

            int buffer;
            for (; (buffer = System.in.read()) >= 0;) {
                if (buffer == '\n') {
                    break;
                }
                if (buffer == '\r') {
                    // Ignore carriage return if on windows for manual testing.
                    continue;
                }
                builder.append((char)buffer);
            }

            return builder.toString();
        } catch (final Exception e) {
            System.exit(0);
            throw new IllegalStateException(e);
        }
    }
}
