import { mkdir, appendFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_LOG_DIRECTORY = join(homedir(), ".braeburn", "logs");

export type StepLogWriter = (line: string) => Promise<void>;

async function ensureDirectoryExists(directoryPath: string): Promise<void> {
  if (existsSync(directoryPath)) {
    return;
  }

  await mkdir(directoryPath, { recursive: true });
}

export async function createLogWriterForStep(
  stepId: string,
  logDirectory: string = DEFAULT_LOG_DIRECTORY,
): Promise<StepLogWriter> {
  await ensureDirectoryExists(logDirectory);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logFilePath = join(
    logDirectory,
    `${stepId}-${timestamp}.log`
  );

  const writeLineToLog = async (line: string): Promise<void> => {
    await appendFile(logFilePath, line + "\n", "utf-8");
  };

  return writeLineToLog;
}

export function findLatestLogFileForStep(
  stepId: string,
  logDirectory: string = DEFAULT_LOG_DIRECTORY,
): string | null {
  if (!existsSync(logDirectory)) {
    return null;
  }

  const allFiles = readdirSync(logDirectory);
  const filesForThisStep = allFiles
    .filter((fileName: string) => fileName.startsWith(`${stepId}-`))
    .sort()
    .reverse();

  if (filesForThisStep.length === 0) {
    return null;
  }

  return join(logDirectory, filesForThisStep[0]);
}

export function listAllStepIdsWithLogs(
  logDirectory: string = DEFAULT_LOG_DIRECTORY,
): string[] {
  if (!existsSync(logDirectory)) {
    return [];
  }

  const allFiles = readdirSync(logDirectory);

  const stepIds = new Set<string>(
    allFiles
      .map((fileName: string) => fileName.split("-")[0])
      .filter((maybeStepId: string | undefined): maybeStepId is string => Boolean(maybeStepId))
  );

  return [...stepIds].sort();
}
