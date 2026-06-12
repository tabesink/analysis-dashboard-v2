'use client';

import { RouteErrorFallback } from '@/components/shared';

export default function DatabaseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorFallback
      error={error}
      reset={reset}
      message="An error occurred while loading the database page."
    />
  );
}
