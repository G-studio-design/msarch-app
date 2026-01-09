// src/components/layout/DashboardClientLayout.tsx
'use client';

import type { ReactNode } from 'react';
import React from 'react';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import DashboardLayoutWrapper from './DashboardLayoutWrapper';

interface DashboardClientLayoutProps {
  children: ReactNode;
  attendanceEnabled: boolean;
}

// This component is a Server Component that wraps the actual client-heavy layout.
// It uses Suspense to handle client-side rendering of the wrapper.
export default function DashboardClientLayout({ children, attendanceEnabled }: DashboardClientLayoutProps) {
  return (
    <Suspense fallback={<DashboardLoadingSkeleton />}>
      <DashboardLayoutWrapper attendanceEnabled={attendanceEnabled}>
        {children}
      </DashboardLayoutWrapper>
    </Suspense>
  );
}

// A simple skeleton to show while the main layout and its hooks are loading.
function DashboardLoadingSkeleton() {
    return (
         <div className="flex min-h-screen w-full bg-muted/40">
            <div className="flex-1 flex flex-col">
                 <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background px-4 sm:px-6">
                    {/* Skeleton Header */}
                 </header>
                 <main className="flex-1 overflow-y-auto p-4 md:p-6">
                     <div className="flex justify-center items-center h-[calc(100vh-56px)]">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                     </div>
                </main>
            </div>
        </div>
    );
}
