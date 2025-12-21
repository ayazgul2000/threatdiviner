'use client';

import { useAuth } from '@/lib/auth-context';
import { AdminLayout } from '@/components/admin-layout';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, admin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!admin) {
    return null; // Will redirect in auth context
  }

  return <AdminLayout>{children}</AdminLayout>;
}
