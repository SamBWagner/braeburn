import { mkdir, appendFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const BRAEBURN_LOG_DIRECTORY = join(homedir(), ".braeburn", "logs");

export type StepLogWriter = (line: string) => Promise<void>;

async function ensureLogDirectoryExists(): Promise<void> {
  if (existsSync(BRAEBURN_LOG_DIRECTORY)) {
    return;
  }

  await mkdir(BRAEBURN_LOG_DIRECTORY, { recursive: true });
}

export async function createLogWriterForStep(
  stepId: string
): Promise<StepLogWriter> {
  await ensureLogDirectoryExists();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logFilePath = join(
    BRAEBURN_LOG_DIRECTORY,
    `${stepId}-${timestamp}.log`
  );

  const writeLineToLog = async (line: string): Promise<void> => {
    await appendFile(logFilePath, line + "\n", "utf-8");
  };

  return writeLineToLog;
}

export function findLatestLogFileForStep(stepId: string): string | null {
  if (!existsSync(BRAEBURN_LOG_DIRECTORY)) {
    return null;
  }

  const allFiles = readdirSync(BRAEBURN_LOG_DIRECTORY);
  const filesForThisStep = allFiles
    .filter((fileName: string) => fileName.startsWith(`${stepId}-`))
    .sort()
    .reverse(); // most recent first

  if (filesForThisStep.length === 0) {
    return null;
  }

  return join(BRAEBURN_LOG_DIRECTORY, filesForThisStep[0]);
}

export function listAllStepIdsWithLogs(): string[] {
  if (!existsSync(BRAEBURN_LOG_DIRECTORY)) {
    return [];
  }

  const allFiles = readdirSync(BRAEBURN_LOG_DIRECTORY);

  const stepIds = new Set<string>(
    allFiles
      .map((fileName: string) => fileName.split("-")[0])
      .filter((maybeStepId: string | undefined): maybeStepId is string => Boolean(maybeStepId))
  );

  return [...stepIds].sort();
}
