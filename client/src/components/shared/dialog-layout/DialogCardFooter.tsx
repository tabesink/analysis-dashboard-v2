import type { ReactNode } from 'react';

export interface DialogCardFooterProps {
  children: ReactNode;
}

export function DialogCardFooter({ children }: DialogCardFooterProps) {
  return (
    <div className="mt-4 flex shrink-0 items-center justify-end gap-2 border-t border-border pt-4">
      {children}
    </div>
  );
}
