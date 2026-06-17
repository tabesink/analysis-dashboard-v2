import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

import {
  SHORT_INFO_MESSAGES,
  SHORT_INFO_TOAST_IDS,
  dismissShortInfoToast,
  showShortInfoToast,
} from '@/lib/feedback/short-info-toast';

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe('short-info-toast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an info toast with the default duration', () => {
    showShortInfoToast('Selection changed — click Render to update');

    expect(toast.info).toHaveBeenCalledWith('Selection changed — click Render to update', {
      id: undefined,
      duration: 6000,
    });
  });

  it('supports stable ids for deduplicated workflow hints', () => {
    showShortInfoToast(SHORT_INFO_MESSAGES.pendingRender, {
      id: SHORT_INFO_TOAST_IDS.pendingRender,
    });

    expect(toast.info).toHaveBeenCalledWith(SHORT_INFO_MESSAGES.pendingRender, {
      id: SHORT_INFO_TOAST_IDS.pendingRender,
      duration: 6000,
    });
  });

  it('dismisses a toast by id', () => {
    dismissShortInfoToast(SHORT_INFO_TOAST_IDS.pendingRender);

    expect(toast.dismiss).toHaveBeenCalledWith(SHORT_INFO_TOAST_IDS.pendingRender);
  });
});
