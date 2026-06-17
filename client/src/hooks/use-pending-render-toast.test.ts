import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SHORT_INFO_MESSAGES,
  SHORT_INFO_TOAST_IDS,
  dismissShortInfoToast,
  showShortInfoToast,
} from '@/lib/feedback/short-info-toast';
import { applyPendingRenderToastTransition } from '@/hooks/use-pending-render-toast';

vi.mock('@/lib/feedback/short-info-toast', () => ({
  SHORT_INFO_MESSAGES: {
    pendingRender: 'Selection changed — click Render to update',
  },
  SHORT_INFO_TOAST_IDS: {
    pendingRender: 'short-info:pending-render',
  },
  showShortInfoToast: vi.fn(),
  dismissShortInfoToast: vi.fn(),
}));

describe('applyPendingRenderToastTransition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a toast when selection becomes dirty', () => {
    const next = applyPendingRenderToastTransition(true, false);

    expect(next).toBe(true);
    expect(showShortInfoToast).toHaveBeenCalledWith(SHORT_INFO_MESSAGES.pendingRender, {
      id: SHORT_INFO_TOAST_IDS.pendingRender,
    });
    expect(dismissShortInfoToast).not.toHaveBeenCalled();
  });

  it('dismisses the toast when selection is rendered', () => {
    const next = applyPendingRenderToastTransition(false, true);

    expect(next).toBe(false);
    expect(dismissShortInfoToast).toHaveBeenCalledWith(SHORT_INFO_TOAST_IDS.pendingRender);
    expect(showShortInfoToast).not.toHaveBeenCalled();
  });

  it('does nothing while selection stays dirty', () => {
    const next = applyPendingRenderToastTransition(true, true);

    expect(next).toBe(true);
    expect(showShortInfoToast).not.toHaveBeenCalled();
    expect(dismissShortInfoToast).not.toHaveBeenCalled();
  });
});
