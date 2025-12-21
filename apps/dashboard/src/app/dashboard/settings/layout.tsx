'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const settingsNav = [
  { name: 'Notifications', href: '/dashboard/settings/notifications' },
  { name: 'Team', href: '/dashboard/settings/team' },
  { name: 'Profile', href: '/dashboard/settings/profile' },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex gap-8">
      {/* Settings Sidebar */}
      <nav className="w-48 flex-shrink-0">
        <ul className="space-y-1">
          {settingsNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`block px-3 py-2 text-sm font-medium rounded-md ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Settings Content */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
