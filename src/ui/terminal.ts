type TerminalOptions = {
  output?: NodeJS.WritableStream;
  screenBuffer?: "main" | "alternate";
};

type CursorCleanup = () => void;

export function hideCursorDuringExecution(options: TerminalOptions = {}): CursorCleanup {
  const output = options.output ?? process.stdout;
  const screenBuffer = options.screenBuffer ?? "main";

  if (screenBuffer === "alternate") {
    output.write("\x1b[?1049h");
  }

  output.write("\x1b[?25l");

  const restoreTerminal = () => {
    output.write("\x1b[?25h");
    if (screenBuffer === "alternate") {
      output.write("\x1b[?1049l");
    }
  };

  const restoreOnExit = () => restoreTerminal();
  const restoreAndExitOnInterrupt = () => {
    restoreTerminal();
    output.write("\n");
    process.exit(130);
  };

  process.on("exit", restoreOnExit);
  process.on("SIGINT", restoreAndExitOnInterrupt);

  return () => {
    process.removeListener("exit", restoreOnExit);
    process.removeListener("SIGINT", restoreAndExitOnInterrupt);
    restoreTerminal();
  };
}
