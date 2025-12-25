// src/app/dashboard/layout.tsx
'use client';
import type { ReactNode } from 'react';
import React, { useEffect, useState } from 'react';
import DashboardLayoutWrapper from '@/components/layout/DashboardLayoutWrapper';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { isAttendanceFeatureEnabled } from '@/services/settings-service';
import { Skeleton } from '@/components/ui/skeleton';

// Define a full-page skeleton for the loading state
function DashboardLoadingSkeleton() {
  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background px-4 sm:px-6">
          <Skeleton className="h-6 w-24" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-md" />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Skeleton className="h-full w-full rounded-lg" />
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { isHydrated, currentUser } = useAuth();
  const router = useRouter();
  const [attendanceEnabled, setAttendanceEnabled] = useState(false);

  useEffect(() => {
    // This effect runs on the client after hydration.
    // If hydration is complete and there's no user, redirect to login.
    if (isHydrated && !currentUser) {
      router.replace('/');
    }
  }, [isHydrated, currentUser, router]);

  useEffect(() => {
    const fetchSettings = async () => {
      const enabled = await isAttendanceFeatureEnabled();
      setAttendanceEnabled(enabled);
    };
    fetchSettings();
  }, []);

  // Show a full-page skeleton if authentication state is not yet hydrated or user is not logged in.
  // This ensures the server and initial client render are identical (both showing the skeleton).
  if (!isHydrated || !currentUser) {
    return <DashboardLoadingSkeleton />;
  }

  // Once the user is confirmed, render the full layout with its content.
  return (
    <DashboardLayoutWrapper attendanceEnabled={attendanceEnabled}>
      {children}
    </DashboardLayoutWrapper>
  );
}
