/**
 * Status pill styles aligned with the Database table (`app/database/page.tsx`).
 */
export function getStatusBadgeClassName(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  if (v === 'Approved') {
    return 'bg-muted text-foreground';
  }
  if (v === 'Obsolete') {
    return 'bg-destructive/10 text-destructive';
  }
  return 'bg-muted text-muted-foreground';
}
