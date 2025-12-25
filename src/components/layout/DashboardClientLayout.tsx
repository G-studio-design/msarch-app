// src/components/layout/DashboardClientLayout.tsx
'use client';

import type { ReactNode } from 'react';
import React from 'react';
import DashboardLayoutWrapper from './DashboardLayoutWrapper';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

interface DashboardClientLayoutProps {
  children: ReactNode;
  attendanceEnabled: boolean;
}

// This is a much simpler loading skeleton, primarily as a fallback.
function DashboardLoadingSkeleton() {
    return (
         <div className="flex min-h-screen w-full items-center justify-center bg-muted/40">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
    );
}

// This component now directly renders the wrapper and handles the auth check.
// It avoids rendering a completely different skeleton structure, which was the source of hydration errors.
export default function DashboardClientLayout({ children, attendanceEnabled }: DashboardClientLayoutProps) {
  const { isHydrated, currentUser } = useAuth();
  
  // This check is crucial. We wait until the Auth context has been hydrated from localStorage.
  // Until then, we show a simple spinner, which prevents any complex UI from being rendered
  // and causing a mismatch with the server's render.
  if (!isHydrated || !currentUser) {
    return <DashboardLoadingSkeleton />;
  }

  // Once hydrated and the user is confirmed, render the full layout.
  // The `attendanceEnabled` prop is passed down correctly.
  return (
    <DashboardLayoutWrapper attendanceEnabled={attendanceEnabled}>
      {children}
    </DashboardLayoutWrapper>
  );
}
