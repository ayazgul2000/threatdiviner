'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/settings/notifications');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">Redirecting to notifications settings...</div>
    </div>
  );
}
