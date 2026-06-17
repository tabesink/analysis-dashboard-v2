import { toast } from 'sonner';

/** Stable ids for deduplicated short informational toasts. */
export const SHORT_INFO_TOAST_IDS = {
  pendingRender: 'short-info:pending-render',
} as const;

/** Shared copy for repeated short informational toasts. */
export const SHORT_INFO_MESSAGES = {
  pendingRender: 'Selection changed — click Render to update',
} as const;

const DEFAULT_DURATION_MS = 6000;

export type ShortInfoToastOptions = {
  id?: string;
  duration?: number;
};

/** Show a brief informational toast for non-blocking workflow hints. */
export function showShortInfoToast(
  message: string,
  options?: ShortInfoToastOptions,
): void {
  toast.info(message, {
    id: options?.id,
    duration: options?.duration ?? DEFAULT_DURATION_MS,
  });
}

/** Dismiss a deduplicated short informational toast by id. */
export function dismissShortInfoToast(id: string): void {
  toast.dismiss(id);
}
