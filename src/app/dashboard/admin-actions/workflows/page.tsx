// src/app/dashboard/admin-actions/workflows/page.tsx
import React, { Suspense } from 'react';
import WorkflowsPageClient from '@/components/dashboard/WorkflowsPageClient';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';


function PageSkeleton() {
    return (
        <div className="container mx-auto py-4 px-4 md:px-6 space-y-6">
            <Card>
            <CardHeader><Skeleton className="h-7 w-1/3 mb-2" /><Skeleton className="h-4 w-2/3" /></CardHeader>
            <CardContent><Skeleton className="h-40 w-full" /></CardContent>
            </Card>
        </div>
    );
}

export default function ManageWorkflowsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
        <WorkflowsPageClient />
    </Suspense>
  );
}
