'use client';

import { ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { ToastProvider } from '@/components/ui/toast';
import { ConfirmDialogProvider } from '@/components/ui/confirm-dialog';
import { ProjectProvider } from '@/contexts/project-context';
import { NlqSearch } from '@/components/search/nlq-search';
import { Bell, HelpCircle } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <ToastProvider>
      <ConfirmDialogProvider>
        <ProjectProvider>
          <div className="flex h-screen bg-gray-100 dark:bg-gray-950">
            {/* Sidebar */}
            <Sidebar />

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Top Header with Search */}
              <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6">
                <div className="flex-1 flex items-center gap-4">
                  <NlqSearch />
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                    <Bell className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                    <HelpCircle className="w-5 h-5" />
                  </button>
                </div>
              </header>

              {/* Page content */}
              <main className="flex-1 overflow-y-auto p-6">
                {children}
              </main>
            </div>
          </div>
        </ProjectProvider>
      </ConfirmDialogProvider>
    </ToastProvider>
  );
}
