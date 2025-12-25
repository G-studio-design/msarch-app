// src/components/layout/DashboardClientLayout.tsx
'use client';

import type { ReactNode } from 'react';
import React from 'react';
import DashboardLayoutWrapper from './DashboardLayoutWrapper';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface DashboardClientLayoutProps {
  children: ReactNode;
  attendanceEnabled: boolean;
}

// This component now directly renders the wrapper and handles the auth check.
// It avoids rendering a completely different skeleton structure, which was the source of hydration errors.
export default function DashboardClientLayout({ children, attendanceEnabled }: DashboardClientLayoutProps) {
  const { isHydrated, currentUser } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    // This effect runs on the client after hydration.
    // If hydration is complete and there's no user, redirect to login.
    if (isHydrated && !currentUser) {
      router.replace('/');
    }
  }, [isHydrated, currentUser, router]);
  
  // Render nothing or a minimal loading state if the user isn't authenticated yet.
  // This prevents the main layout from flashing before the redirect.
  if (!currentUser) {
    return null; // Returning null is safer than a skeleton here to avoid mismatches.
  }

  // Once the user is confirmed, render the full layout.
  // The `attendanceEnabled` prop is passed down correctly.
  return (
    <DashboardLayoutWrapper attendanceEnabled={attendanceEnabled}>
      {children}
    </DashboardLayoutWrapper>
  );
}
