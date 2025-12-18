'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('http://localhost:3001/auth/me', {
          credentials: 'include',
        });

        if (response.ok) {
          router.push('/dashboard');
        } else {
          router.push('/login');
        }
      } catch {
        router.push('/login');
      } finally {
        setChecking(false);
      }
    };

    checkAuth();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            ThreatDiviner
          </h1>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return null;
}
