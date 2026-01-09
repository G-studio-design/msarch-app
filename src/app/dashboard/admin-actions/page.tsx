
import React, { Suspense } from 'react';
import { getAllProjects } from '@/services/project-service';
import { getAllUniqueStatuses } from '@/services/workflow-service';
import { getAppSettings } from '@/services/settings-service';
import AdminActionsClient from '@/components/dashboard/AdminActionsClient';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function AdminActionsPage() {
    const [fetchedProjects, statuses, settings] = await Promise.all([
       getAllProjects(),
       getAllUniqueStatuses(),
       getAppSettings()
    ]);

    const initialData = {
        projects: fetchedProjects,
        availableStatuses: statuses,
        appSettings: settings
    };

    return (
        <Suspense fallback={<PageSkeleton />}>
            <AdminActionsClient initialData={initialData} />
        </Suspense>
    );
}

function PageSkeleton() {
    return (
        <div className="container mx-auto py-4 px-4 md:px-6 space-y-6">
           <Card>
              <CardHeader>
                <Skeleton className="h-7 w-3/5 mb-2" />
                <Skeleton className="h-4 w-4/5" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-40 w-full" />
              </CardContent>
           </Card>
       </div>
   );
}
