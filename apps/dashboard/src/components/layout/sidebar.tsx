'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useProject } from '@/contexts/project-context';
import { ProjectSelector } from './project-selector';
import {
  LayoutDashboard,
  GitBranch,
  Crosshair,
  Cloud,
  Bell,
  Shield,
  FileText,
  TrendingUp,
  Building2,
  Users,
  Key,
  BellRing,
  Plug,
  ChevronDown,
  ChevronRight,
  LogOut,
  Scan,
} from 'lucide-react';

type MenuItem = {
  href: string;
  label: string;
  icon: any;
};

type MenuSection = {
  type: 'section';
  label: string;
  icon: any;
  items: MenuItem[];
  defaultExpanded?: boolean;
};

type MenuConfigItem = MenuSection;

// New menu structure per v3.0 spec
function getMenuConfig(): MenuConfigItem[] {
  return [
    // ═══ SECURITY SCANNING ═══
    {
      type: 'section',
      label: 'Security Scanning',
      icon: Scan,
      defaultExpanded: true,
      items: [
        { href: '/dashboard/repositories', label: 'Repositories', icon: GitBranch },
        { href: '/dashboard/targets', label: 'Targets', icon: Crosshair },
        { href: '/dashboard/cloud-accounts', label: 'Cloud Accounts', icon: Cloud },
        { href: '/dashboard/monitoring', label: 'Monitoring', icon: Bell },
      ],
    },

    // ═══ INSIGHTS ═══
    {
      type: 'section',
      label: 'Insights',
      icon: TrendingUp,
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/dashboard/compliance', label: 'Compliance', icon: Shield },
        { href: '/dashboard/reports', label: 'Reports', icon: FileText },
        { href: '/dashboard/analytics', label: 'Analytics', icon: TrendingUp },
      ],
    },

    // ═══ SETTINGS ═══
    {
      type: 'section',
      label: 'Settings',
      icon: Building2,
      items: [
        { href: '/dashboard/settings/org', label: 'Organization', icon: Building2 },
        { href: '/dashboard/settings/team', label: 'Team', icon: Users },
        { href: '/dashboard/settings/api-keys', label: 'API Keys', icon: Key },
        { href: '/dashboard/settings/notifications', label: 'Notifications', icon: BellRing },
        { href: '/dashboard/settings/integrations', label: 'Integrations', icon: Plug },
      ],
    },
  ];
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { currentProject } = useProject();
  const [expandedSections, setExpandedSections] = useState<string[]>(['Security Scanning']);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const menuConfig = getMenuConfig();

  // Auto-expand section containing active route
  useEffect(() => {
    menuConfig.forEach((item) => {
      const hasActiveItem = item.items.some(
        (subItem) => pathname === subItem.href || pathname.startsWith(subItem.href + '/')
      );
      if (hasActiveItem && !expandedSections.includes(item.label)) {
        setExpandedSections((prev) => [...prev, item.label]);
      }
    });
  }, [pathname, menuConfig, expandedSections]);

  const toggleSection = (label: string) => {
    setExpandedSections((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 h-screen flex flex-col">
      {/* Logo - Fixed */}
      <div className="p-4 border-b border-slate-700">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Shield className="w-8 h-8 text-blue-500" />
          <span className="text-xl font-bold text-white">ThreatDiviner</span>
        </Link>
      </div>

      {/* Project Selector */}
      <div className="border-b border-slate-700 overflow-visible relative z-10">
        <ProjectSelector />
      </div>

      {/* Navigation - Scrollable */}
      <nav className="flex-1 overflow-y-auto py-4">
        {menuConfig.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSections.includes(section.label);
          const hasActiveChild = section.items.some((sub) => isActive(sub.href));

          return (
            <div
              key={section.label}
              className="mb-1"
              ref={(el) => { sectionRefs.current[section.label] = el; }}
            >
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.label)}
                className={`
                  w-full flex items-center justify-between px-4 py-2.5 mx-2 rounded-lg
                  transition-colors duration-150
                  ${hasActiveChild ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'}
                  hover:bg-slate-800
                `}
                style={{ width: 'calc(100% - 1rem)' }}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-semibold uppercase tracking-wider">{section.label}</span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>

              {/* Section items (collapsible) */}
              {isExpanded && (
                <div className="mt-1 space-y-0.5">
                  {section.items.map((subItem) => {
                    const SubIcon = subItem.icon;
                    return (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        className={`
                          flex items-center gap-3 px-4 py-2 mx-4 rounded-lg
                          transition-colors duration-150 text-sm
                          ${isActive(subItem.href)
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-slate-800 text-slate-300 hover:text-slate-100'
                          }
                        `}
                      >
                        <SubIcon className="w-4 h-4" />
                        <span>{subItem.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User section - Fixed at bottom */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.name || user?.email}
            </p>
            <p className="text-xs text-slate-400 truncate capitalize">
              {user?.role?.toLowerCase()}
            </p>
          </div>
          <button
            onClick={logout}
            className="ml-2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
