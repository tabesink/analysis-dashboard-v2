export interface TaskPollConnectionState {
  connectionLost: boolean;
  message?: string;
}

export interface TaskPollErrorClassification {
  retryable: boolean;
  message: string;
}

export interface WaitForTaskStatusOptions<TEvent> {
  fetchStatus: () => Promise<TEvent>;
  isTerminal: (event: TEvent) => boolean;
  onUpdate?: (event: TEvent) => void;
  onConnectionStateChange?: (state: TaskPollConnectionState) => void;
  pollMs: number;
  retryWindowMs: number;
  retryMaxBackoffMs: number;
  classifyError: (error: unknown) => TaskPollErrorClassification;
  timeoutMessage: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function nextPollBackoff(currentMs: number, maxBackoffMs: number): number {
  if (currentMs <= 0) {
    return 1000;
  }
  return Math.min(currentMs * 2, maxBackoffMs);
}

export async function waitForTaskStatus<TEvent>({
  fetchStatus,
  isTerminal,
  onUpdate,
  onConnectionStateChange,
  pollMs,
  retryWindowMs,
  retryMaxBackoffMs,
  classifyError,
  timeoutMessage,
}: WaitForTaskStatusOptions<TEvent>): Promise<TEvent> {
  const retryStartedAt = { current: 0 };
  let backoffMs = 0;

  for (;;) {
    try {
      const event = await fetchStatus();
      retryStartedAt.current = 0;
      backoffMs = 0;
      onConnectionStateChange?.({ connectionLost: false });
      onUpdate?.(event);
      if (isTerminal(event)) {
        return event;
      }
      await sleep(pollMs);
    } catch (error) {
      const classified = classifyError(error);
      if (!classified.retryable) {
        throw error instanceof Error ? error : new Error(classified.message);
      }

      const now = Date.now();
      if (retryStartedAt.current === 0) {
        retryStartedAt.current = now;
      }
      if (now - retryStartedAt.current > retryWindowMs) {
        throw new Error(timeoutMessage);
      }

      onConnectionStateChange?.({
        connectionLost: true,
        message: classified.message,
      });
      backoffMs = nextPollBackoff(backoffMs, retryMaxBackoffMs);
      await sleep(backoffMs);
    }
  }
}
