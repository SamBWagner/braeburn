type TerminalOptions = {
  output?: NodeJS.WritableStream;
};

type CursorCleanup = () => void;

export function hideCursorDuringExecution(options: TerminalOptions = {}): CursorCleanup {
  const output = options.output ?? process.stdout;

  output.write("\x1b[?25l");

  const restoreOnExit = () => output.write("\x1b[?25h");
  const restoreAndExitOnInterrupt = () => {
    output.write("\x1b[?25h\n");
    process.exit(130);
  };

  process.on("exit", restoreOnExit);
  process.on("SIGINT", restoreAndExitOnInterrupt);

  return () => {
    process.removeListener("exit", restoreOnExit);
    process.removeListener("SIGINT", restoreAndExitOnInterrupt);
    output.write("\x1b[?25h");
  };
}
