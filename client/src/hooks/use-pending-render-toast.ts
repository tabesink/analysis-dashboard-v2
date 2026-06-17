'use client';

import { useEffect, useRef } from 'react';
import {
  SHORT_INFO_MESSAGES,
  SHORT_INFO_TOAST_IDS,
  dismissShortInfoToast,
  showShortInfoToast,
} from '@/lib/feedback/short-info-toast';

export function applyPendingRenderToastTransition(
  hasUnrenderedChanges: boolean,
  previousHasUnrenderedChanges: boolean,
): boolean {
  const becameDirty = hasUnrenderedChanges && !previousHasUnrenderedChanges;
  const becameClean = !hasUnrenderedChanges && previousHasUnrenderedChanges;

  if (becameDirty) {
    showShortInfoToast(SHORT_INFO_MESSAGES.pendingRender, {
      id: SHORT_INFO_TOAST_IDS.pendingRender,
    });
  } else if (becameClean) {
    dismissShortInfoToast(SHORT_INFO_TOAST_IDS.pendingRender);
  }

  return hasUnrenderedChanges;
}

/** Surface pending render selection changes as a toast only (no inline banner). */
export function usePendingRenderToast(hasUnrenderedChanges: boolean): void {
  const previousHasUnrenderedChangesRef = useRef(false);

  useEffect(() => {
    previousHasUnrenderedChangesRef.current = applyPendingRenderToastTransition(
      hasUnrenderedChanges,
      previousHasUnrenderedChangesRef.current,
    );
  }, [hasUnrenderedChanges]);
}
