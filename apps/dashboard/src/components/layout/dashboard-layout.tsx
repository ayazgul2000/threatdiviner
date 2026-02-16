'use client';

import { ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { ToastProvider } from '@/components/ui/toast';
import { ConfirmDialogProvider } from '@/components/ui/confirm-dialog';
import { ProjectProvider } from '@/contexts/project-context';

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
