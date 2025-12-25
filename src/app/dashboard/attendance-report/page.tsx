
import React, { Suspense } from 'react';
import AttendanceReportClient from '@/components/dashboard/AttendanceReportClient';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';


export const dynamic = 'force-dynamic';

export default async function AttendanceReportPage() {
    // Data fetching logic is moved to the client component.
    // Server just renders the shell.
    return (
        <Suspense fallback={<PageSkeleton />}>
            <AttendanceReportClient />
        </Suspense>
    );
}

function PageSkeleton() {
    return (
        <div className="container mx-auto py-4 px-4 md:px-6 space-y-6">
            <Skeleton className="h-8 w-1/3" />
            <Card><CardContent className="pt-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
        </div>
    );
}
