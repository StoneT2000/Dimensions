package kit;

public class Input {
  private final String[] input;
  private int index;
  private final static String DELIM = ",";

  public Input(final String line) {
      input = line.split(Input.DELIM);
  }

  public int getInt() {
      return Integer.parseInt(input[index++]);
  }

  public String getString() {
      return input[index++];
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
              
              builder.append((char)buffer);
          }

          return builder.toString();
      } catch (final Exception e) {
          System.exit(0);
          throw new IllegalStateException(e);
      }
  }
}
