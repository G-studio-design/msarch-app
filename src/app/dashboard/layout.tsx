
// src/app/dashboard/layout.tsx
import type { ReactNode } from 'react';
import DashboardClientLayout from '@/components/layout/DashboardClientLayout';
import { isAttendanceFeatureEnabled } from '@/services/settings-service';

// This is a Server Component that fetches data and passes it to the client layout.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Fetch server-side data here. This is safe.
  const attendanceEnabled = await isAttendanceFeatureEnabled();
  
  // Pass the data to the client component as a prop.
  return <DashboardClientLayout attendanceEnabled={attendanceEnabled}>{children}</DashboardClientLayout>;
}
