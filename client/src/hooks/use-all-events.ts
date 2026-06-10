'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api/dashboard';
import { useAuthStore } from '@/stores/auth-store';
import type { EventMetadata, GlobalFilters } from '@/types/api';

export function useAllEvents(globalFilters: GlobalFilters = {}) {
  const isAuthed = useAuthStore((s) => s.status) === 'authenticated';
  const query = useQuery<{ events: EventMetadata[] }, Error, EventMetadata[]>({
    queryKey: ['all-events', globalFilters],
    queryFn: () =>
      dashboardApi.getEvents({ global_filters: globalFilters }, 500),
    select: (data) => data.events,
    enabled: isAuthed,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    structuralSharing: false,
  });

  return {
    allEvents: query.data ?? [],
    isLoading: isAuthed && query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
