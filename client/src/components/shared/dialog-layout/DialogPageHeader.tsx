import type { ReactNode } from 'react';

export interface DialogPageHeaderProps {
  title: string;
  children?: ReactNode;
}

export function DialogPageHeader({ title, children }: DialogPageHeaderProps) {
  return (
    <header className="mb-5 shrink-0 border-b border-border pb-4">
      <h2 className="text-base font-medium text-foreground">{title}</h2>
      {children}
    </header>
  );
}
