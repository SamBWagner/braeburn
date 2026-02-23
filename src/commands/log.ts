import { createReadStream } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  findLatestLogFileForStep,
  listAllStepIdsWithLogs,
} from "../logger.js";

const BRAEBURN_LOG_DIRECTORY = join(homedir(), ".braeburn", "logs");

type ShowLogOptions = {
  stepId: string;
};

function streamFileToStdout(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath, { encoding: "utf-8" });
    stream.on("data", (chunk: unknown) => process.stdout.write(String(chunk)));
    stream.on("end", resolve);
    stream.on("error", reject);
  });
}

export async function runLogCommand(options: ShowLogOptions): Promise<void> {
  const logFilePath = findLatestLogFileForStep(options.stepId);

  if (!logFilePath) {
    process.stderr.write(
      `No logs found for step "${options.stepId}".\n` +
        `Log files are stored in: ${BRAEBURN_LOG_DIRECTORY}\n`
    );
    process.exitCode = 1;
    return;
  }

  await streamFileToStdout(logFilePath);
}

export function runLogListCommand(): void {
  const stepIdsWithLogs = listAllStepIdsWithLogs();

  if (stepIdsWithLogs.length === 0) {
    process.stdout.write(
      `No logs found yet. Run braeburn to generate logs.\n`
    );
    return;
  }

  process.stdout.write("Available step logs:\n\n");
  for (const stepId of stepIdsWithLogs) {
    process.stdout.write(`  ${stepId}\n`);
  }
  process.stdout.write(
    `\nUsage: braeburn log <step>  (e.g. braeburn log homebrew)\n`
  );
}
