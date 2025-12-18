'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserProfile {
  id: string;
  email: string;
  role: string;
  tenantId?: string;
  tenantSlug?: string;
  tenantName?: string;
  createdAt?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('http://localhost:3001/auth/profile', {
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 401) {
            router.push('/login');
            return;
          }
          throw new Error('Failed to fetch profile');
        }

        const data = await response.json();
        setUser(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:3001/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
      router.push('/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-red-600 dark:text-red-400">{error || 'Not authenticated'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            ThreatDiviner
          </h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {user.email}
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Welcome, {user.email}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                User Info
              </h3>
              <dl className="space-y-2">
                <div className="flex">
                  <dt className="w-24 text-sm text-gray-500 dark:text-gray-400">Email:</dt>
                  <dd className="text-sm text-gray-900 dark:text-white">{user.email}</dd>
                </div>
                <div className="flex">
                  <dt className="w-24 text-sm text-gray-500 dark:text-gray-400">Role:</dt>
                  <dd className="text-sm text-gray-900 dark:text-white capitalize">{user.role}</dd>
                </div>
                <div className="flex">
                  <dt className="w-24 text-sm text-gray-500 dark:text-gray-400">User ID:</dt>
                  <dd className="text-sm text-gray-900 dark:text-white font-mono text-xs">{user.id}</dd>
                </div>
              </dl>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Organization
              </h3>
              <dl className="space-y-2">
                <div className="flex">
                  <dt className="w-24 text-sm text-gray-500 dark:text-gray-400">Name:</dt>
                  <dd className="text-sm text-gray-900 dark:text-white">{user.tenantName || 'N/A'}</dd>
                </div>
                <div className="flex">
                  <dt className="w-24 text-sm text-gray-500 dark:text-gray-400">Slug:</dt>
                  <dd className="text-sm text-gray-900 dark:text-white">{user.tenantSlug || 'N/A'}</dd>
                </div>
                <div className="flex">
                  <dt className="w-24 text-sm text-gray-500 dark:text-gray-400">Tenant ID:</dt>
                  <dd className="text-sm text-gray-900 dark:text-white font-mono text-xs">{user.tenantId || 'N/A'}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-green-700 dark:text-green-400 font-medium">
                Authentication Status: Active
              </p>
              <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                You are successfully authenticated with multi-tenant JWT.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
