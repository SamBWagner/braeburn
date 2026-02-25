const ACTIVITY_FRAMES = ["◐", "◓", "◑", "◒"] as const;

export function getActivityIndicatorFrame(frameIndex: number): string {
  const normalizedFrameIndex = Math.abs(Math.trunc(frameIndex));
  return ACTIVITY_FRAMES[normalizedFrameIndex % ACTIVITY_FRAMES.length];
}
