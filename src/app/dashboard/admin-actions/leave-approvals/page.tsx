
import React, { Suspense } from 'react';
import { getAllLeaveRequests } from '@/services/leave-request-service';
import LeaveApprovalsClient from '@/components/dashboard/LeaveApprovalsClient';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function LeaveApprovalsPage() {
  const allRequests = await getAllLeaveRequests();

  return (
    <Suspense fallback={<PageSkeleton />}>
      <LeaveApprovalsClient initialRequests={allRequests} />
    </Suspense>
  );
}

function PageSkeleton() {
    return (
      <div className="container mx-auto py-4 px-4 md:px-6">
        <Card>
          <CardHeader><Skeleton className="h-7 w-1/3 mb-2" /><Skeleton className="h-4 w-2/3" /></CardHeader>
          <CardContent><Skeleton className="h-64 w-full" /></CardContent>
        </Card>
      </div>
    );
}
