'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useProject } from '@/contexts/project-context';
import { ProjectSelector } from './project-selector';
import {
  LayoutDashboard,
  FolderGit2,
  GitBranch,
  Search,
  Bug,
  Shield,
  Cloud,
  Lightbulb,
  Settings,
  ChevronDown,
  ChevronRight,
  Target,
  Globe,
  Workflow,
  Database,
  Bell,
  Key,
  Users,
  FileText,
  Server,
  Scan,
  AlertTriangle,
  BarChart3,
  Skull,
  Network,
  LogOut,
  Building2,
  Package,
  Clock,
  CheckCircle2,
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
  requiresProject?: boolean;
  adminOnly?: boolean;
};

type TopLevelItem = {
  type: 'item';
  href: string;
  label: string;
  icon: any;
};

type MenuConfigItem = TopLevelItem | MenuSection;

// Build menu config dynamically based on project context
function getMenuConfig(hasProject: boolean, projectName?: string): MenuConfigItem[] {
  const config: MenuConfigItem[] = [
    // ═══ WORKSPACE ═══
    { type: 'item', href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { type: 'item', href: '/dashboard/projects', label: 'Projects', icon: FolderGit2 },
  ];

  // ═══ PROJECT: [Name] ═══ (only when project selected)
  if (hasProject) {
    config.push({
      type: 'section',
      label: projectName ? `Project: ${projectName.slice(0, 15)}${projectName.length > 15 ? '...' : ''}` : 'Project',
      icon: FolderGit2,
      items: [
        { href: '/dashboard/repositories', label: 'Repositories', icon: GitBranch },
        { href: '/dashboard/scans', label: 'Scans', icon: Search },
        { href: '/dashboard/findings', label: 'Findings', icon: Bug },
        { href: '/dashboard/baselines', label: 'Baselines', icon: FileText },
      ],
      requiresProject: true,
    });
  }

  // ═══ SECURITY ANALYSIS ═══
  config.push({
    type: 'section',
    label: 'Security Analysis',
    icon: Shield,
    items: [
      { href: '/dashboard/threat-modeling', label: 'Threat Models', icon: Target },
      { href: '/dashboard/pen-testing', label: 'Pen Testing', icon: Scan },
      { href: '/dashboard/compliance', label: 'Compliance', icon: CheckCircle2 },
      { href: '/dashboard/sbom', label: 'SBOM', icon: Package },
      { href: '/dashboard/containers', label: 'Containers', icon: Server },
    ],
  });

  // ═══ DEPLOYMENTS ═══
  config.push({
    type: 'section',
    label: 'Deployments',
    icon: Cloud,
    items: [
      { href: '/dashboard/environments', label: 'Environments', icon: Globe },
      { href: '/dashboard/pipeline', label: 'Pipeline', icon: Workflow },
    ],
  });

  // ═══ INTELLIGENCE ═══
  config.push({
    type: 'section',
    label: 'Intelligence',
    icon: Lightbulb,
    items: [
      { href: '/dashboard/vulndb', label: 'Vulnerabilities', icon: Database },
      { href: '/dashboard/attack', label: 'ATT&CK Matrix', icon: Skull },
      { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/dashboard/sla', label: 'SLA Tracker', icon: Clock },
    ],
  });

  // ═══ SETTINGS ═══
  const settingsItems: MenuItem[] = [];

  if (hasProject) {
    settingsItems.push({ href: '/dashboard/settings/project', label: 'Project Settings', icon: Settings });
  }

  // Org settings (show for all but will be access-controlled)
  settingsItems.push({ href: '/dashboard/settings/org', label: 'Organization', icon: Building2 });

  config.push({
    type: 'section',
    label: 'Settings',
    icon: Settings,
    items: settingsItems,
  });

  return config;
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { currentProject } = useProject();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const hasProject = !!currentProject;
  const menuConfig = getMenuConfig(hasProject, currentProject?.name);

  // Auto-expand section containing active route
  useEffect(() => {
    menuConfig.forEach((item) => {
      if (item.type === 'section') {
        const hasActiveItem = item.items.some(
          (subItem) => pathname === subItem.href || pathname.startsWith(subItem.href + '/')
        );
        if (hasActiveItem && !expandedSections.includes(item.label)) {
          setExpandedSections((prev) => [...prev, item.label]);
        }
      }
    });
  }, [pathname, menuConfig]);

  const toggleSection = (label: string) => {
    const isExpanding = !expandedSections.includes(label);

    // Close all others, toggle this one (accordion behavior)
    setExpandedSections(isExpanding ? [label] : []);

    // Scroll section into view when expanding
    if (isExpanding) {
      setTimeout(() => {
        const sectionEl = sectionRefs.current[label];
        if (sectionEl) {
          sectionEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
    }
  };

  const isActive = (href: string) => {
    return pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
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
        {menuConfig.map((item) => {
          if (item.type === 'item') {
            // Regular menu item
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg
                  transition-colors duration-150
                  ${isActive(item.href)
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-slate-800 text-slate-300'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          }

          // Collapsible section
          const Icon = item.icon;
          const isExpanded = expandedSections.includes(item.label);
          const hasActiveChild = item.items.some((sub) => isActive(sub.href));
          const isProjectSection = item.requiresProject;

          return (
            <div
              key={item.label}
              className="mt-1"
              ref={(el) => { sectionRefs.current[item.label] = el; }}
            >
              {/* Section header */}
              <button
                onClick={() => toggleSection(item.label)}
                className={`
                  w-full flex items-center justify-between px-4 py-2.5 mx-2 rounded-lg
                  transition-colors duration-150
                  ${hasActiveChild ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'}
                  ${isProjectSection ? 'bg-slate-800/50' : ''}
                  hover:bg-slate-800
                `}
                style={{ width: 'calc(100% - 1rem)' }}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>

              {/* Section items (collapsible) */}
              {isExpanded && (
                <div className="ml-4 mt-1 space-y-0.5">
                  {item.items.map((subItem) => {
                    const SubIcon = subItem.icon;
                    return (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        className={`
                          flex items-center gap-3 px-4 py-2 mx-2 rounded-lg
                          transition-colors duration-150 text-sm
                          ${isActive(subItem.href)
                            ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-500'
                            : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
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
