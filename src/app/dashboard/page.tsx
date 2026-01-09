// src/app/dashboard/page.tsx
import React, { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getDictionary } from '@/lib/translations';
import { LanguageProvider } from '@/context/LanguageContext';
import { AuthProvider } from '@/context/AuthContext';
import { DashboardPageClient } from '@/components/dashboard/DashboardPageClient';

// This is a React Server Component (RSC)
// It now acts as a layout shell, composing smaller, independent Server Components.
export default async function DashboardPage() {
  // We pass a dummy initialData object or remove it entirely, 
  // as the new child components will fetch their own data.
  const initialData = {
    projects: [],
    leaveRequests: [],
    holidays: [],
    allUsers: [],
    todaysAttendance: [],
    attendanceEnabled: false, // This will be refetched where needed or passed differently
  };

  return (
    // Wrap the entire client component in AuthProvider and LanguageProvider
    // to ensure context is available.
    <AuthProvider>
        <LanguageProvider>
            <DashboardPageClient initialData={initialData} />
        </LanguageProvider>
    </AuthProvider>
  );
}
