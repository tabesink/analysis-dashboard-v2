'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { openSettingsDialog } from '@/stores/settings-dialog-store';

export default function SettingsUsersRedirect() {
  const router = useRouter();

  useEffect(() => {
    openSettingsDialog('user-management');
    router.replace('/dashboard');
  }, [router]);

  return null;
}
