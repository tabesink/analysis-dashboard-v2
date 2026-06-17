import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DialogContentCardProps {
  children: ReactNode;
  contextBar?: ReactNode;
  alertBar?: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  'data-testid'?: string;
}

export function DialogContentCard({
  children,
  contextBar,
  alertBar,
  footer,
  className,
  bodyClassName,
  'data-testid': dataTestId,
}: DialogContentCardProps) {
  return (
    <div
      data-testid={dataTestId}
      className={cn(
        'flex min-h-0 flex-col gap-0 overflow-hidden rounded-lg border border-border bg-card shadow-subtle',
        className,
      )}
    >
      {contextBar ? <div className="shrink-0">{contextBar}</div> : null}
      {alertBar ? <div className="shrink-0 px-4 pt-3">{alertBar}</div> : null}
      <div className={cn('flex min-h-0 flex-1 flex-col p-4', bodyClassName)}>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? <div className="shrink-0">{footer}</div> : null}
      </div>
    </div>
  );
}
