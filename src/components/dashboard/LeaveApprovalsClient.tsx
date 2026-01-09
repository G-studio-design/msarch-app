'use client';

// src/components/dashboard/LeaveApprovalsClient.tsx
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Loader2, Inbox, MessageSquareText } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { getDictionary } from '@/lib/translations';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import type { LeaveRequest } from '@/types/leave-request-types';
import { format, parseISO } from 'date-fns';
import { id as IndonesianLocale, enUS as EnglishLocale } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const defaultDict = getDictionary('en');

interface LeaveApprovalsClientProps {
  initialRequests: LeaveRequest[];
}

export default function LeaveApprovalsClient({ initialRequests }: LeaveApprovalsClientProps) {
  const { currentUser } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();

  const [dict, setDict] = React.useState(defaultDict);
  const [leaveApprovalsDict, setLeaveApprovalsDict] = React.useState(defaultDict.leaveApprovalsPage);

  const [pendingRequests, setPendingRequests] = React.useState<LeaveRequest[]>([]);
  const [isProcessing, setIsProcessing] = React.useState<string | false>(false);

  const [isRejectDialogOpen, setIsRejectDialogOpen] = React.useState(false);
  const [requestToReject, setRequestToReject] = React.useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState('');

  React.useEffect(() => {
    const newDictData = getDictionary(language);
    setDict(newDictData);
    setLeaveApprovalsDict(newDictData.leaveApprovalsPage);
  }, [language]);

  React.useEffect(() => {
    setPendingRequests(initialRequests.filter(req => req.status === 'Pending'));
  }, [initialRequests]);

  const currentLocale = language === 'id' ? IndonesianLocale : EnglishLocale;

  const fetchPendingRequests = React.useCallback(async () => {
    if (currentUser && currentUser.roles.includes('Owner')) {
      try {
        const response = await fetch('/api/leave-requests');
        if (!response.ok) {
          throw new Error(leaveApprovalsDict.toast.fetchError);
        }
        const allRequests: LeaveRequest[] = await response.json();
        setPendingRequests(allRequests.filter(req => req.status === 'Pending'));
      } catch (error: any) {
        console.error("Failed to fetch leave requests:", error);
        toast({ variant: 'destructive', title: leaveApprovalsDict.toast.errorTitle, description: error.message });
      }
    }
  }, [currentUser, toast, leaveApprovalsDict]);

  const handleApprove = async (requestId: string) => {
    if (!currentUser || !currentUser.roles.includes('Owner')) return;
    setIsProcessing(requestId);
    try {
      const response = await fetch(`/api/leave-requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approverUserId: currentUser.id, approverUsername: currentUser.username }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || leaveApprovalsDict.toast.actionFailed);
      }
      toast({ title: leaveApprovalsDict.toast.approvedSuccessTitle, description: leaveApprovalsDict.toast.approvedSuccessDesc });
      fetchPendingRequests(); // Refresh list
    } catch (error: any) {
      console.error("Error approving leave request:", error);
      toast({ variant: 'destructive', title: leaveApprovalsDict.toast.errorTitle, description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const openRejectDialog = (request: LeaveRequest) => {
    setRequestToReject(request);
    setRejectionReason('');
    setIsRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!currentUser || !currentUser.roles.includes('Owner') || !requestToReject || !rejectionReason.trim()) {
      toast({ variant: 'destructive', title: leaveApprovalsDict.toast.errorTitle, description: leaveApprovalsDict.toast.reasonRequired });
      return;
    }
    setIsProcessing(requestToReject.id);
    try {
      const response = await fetch(`/api/leave-requests/${requestToReject.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rejectorUserId: currentUser.id,
          rejectorUsername: currentUser.username,
          rejectionReason,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || leaveApprovalsDict.toast.actionFailed);
      }
      toast({ title: leaveApprovalsDict.toast.rejectedSuccessTitle, description: leaveApprovalsDict.toast.rejectedSuccessDesc });
      fetchPendingRequests(); // Refresh list
      setIsRejectDialogOpen(false);
      setRequestToReject(null);
    } catch (error: any) {
      console.error("Error rejecting leave request:", error);
      toast({ variant: 'destructive', title: leaveApprovalsDict.toast.errorTitle, description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
      return format(start, 'PP', { locale: currentLocale });
    }
    return `${format(start, 'PP', { locale: currentLocale })} - ${format(end, 'PP', { locale: currentLocale })}`;
  };
  
  const getTranslatedLeaveType = (leaveType: string): string => {
    if (!dict?.leaveRequestPage?.leaveTypes) return leaveType;
    const leaveTypesDict = dict.leaveRequestPage.leaveTypes;
    const key = leaveType.toLowerCase().replace(/ /g, '').replace(/[^a-z0-9]/gi, '') as keyof typeof leaveTypesDict;
    return leaveTypesDict[key] || leaveType;
  };

  if (!currentUser || !currentUser.roles.includes('Owner')) {
    return (
      <div className="container mx-auto py-4 px-4 md:px-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">{dict.manageUsersPage.accessDeniedTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{dict.manageUsersPage.accessDeniedDesc}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 px-4 md:px-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl">{leaveApprovalsDict.title}</CardTitle>
          <CardDescription>{leaveApprovalsDict.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10 text-muted-foreground">
              <Inbox className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">{leaveApprovalsDict.noPendingRequests}</p>
              <p className="text-sm">{leaveApprovalsDict.allCaughtUp}</p>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden md:block">
                <ScrollArea className="w-full rounded-md border">
                  <Table>
                    <TableCaption>{leaveApprovalsDict.tableCaption}</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px]">{leaveApprovalsDict.tableHeaders.employee}</TableHead>
                        <TableHead>{leaveApprovalsDict.tableHeaders.leaveType}</TableHead>
                        <TableHead className="min-w-[250px]">{leaveApprovalsDict.tableHeaders.dates}</TableHead>
                        <TableHead>{leaveApprovalsDict.tableHeaders.reason}</TableHead>
                        <TableHead className="text-right min-w-[180px]">{leaveApprovalsDict.tableHeaders.actions}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingRequests.map((req) => (
                        <TableRow key={req.id}>
                          <TableCell className="font-medium">{req.displayName || req.username}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{getTranslatedLeaveType(req.leaveType)}</Badge>
                          </TableCell>
                          <TableCell>{formatDateRange(req.startDate, req.endDate)}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="link" size="sm" className="p-0 h-auto text-muted-foreground hover:text-primary">
                                      <MessageSquareText className="mr-1 h-3.5 w-3.5"/> {leaveApprovalsDict.viewReason}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>{leaveApprovalsDict.reasonDialogTitle.replace('{employee}', req.displayName || req.username)}</DialogTitle>
                                    </DialogHeader>
                                    <div className="py-4 text-sm text-foreground whitespace-pre-wrap max-h-60 overflow-y-auto">{req.reason}</div>
                                    <DialogFooter>
                                        <Button type="button" variant="outline" onClick={() => (document.querySelector('[data-radix-dialog-default-open="true"] [aria-label="Close"]') as HTMLElement)?.click()}>{leaveApprovalsDict.closeButton}</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end items-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => openRejectDialog(req)} disabled={isProcessing === req.id} className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive">
                                {isProcessing === req.id && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                <XCircle className="mr-1.5 h-3.5 w-3.5" /> {leaveApprovalsDict.rejectButton}
                              </Button>
                              <Button size="sm" onClick={() => handleApprove(req.id)} disabled={isProcessing === req.id} className="bg-green-600 hover:bg-green-700 text-white">
                                {isProcessing === req.id && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> {leaveApprovalsDict.approveButton}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>

              {/* Mobile View */}
              <div className="grid gap-4 md:hidden">
                {pendingRequests.map((req) => (
                  <Card key={req.id} className="w-full">
                    <CardHeader>
                      <CardTitle className="text-base">{req.displayName || req.username}</CardTitle>
                      <CardDescription>
                        <Badge variant="outline">{getTranslatedLeaveType(req.leaveType)}</Badge>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <p className="font-semibold text-muted-foreground">{leaveApprovalsDict.tableHeaders.dates}</p>
                        <p>{formatDateRange(req.startDate, req.endDate)}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-muted-foreground">{leaveApprovalsDict.tableHeaders.reason}</p>
                         <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="link" size="sm" className="p-0 h-auto text-muted-foreground hover:text-primary">
                                  <MessageSquareText className="mr-1 h-3.5 w-3.5"/> {leaveApprovalsDict.viewReason}
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>{leaveApprovalsDict.reasonDialogTitle.replace('{employee}', req.displayName || req.username)}</DialogTitle>
                                </DialogHeader>
                                <div className="py-4 text-sm text-foreground whitespace-pre-wrap max-h-60 overflow-y-auto">{req.reason}</div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => (document.querySelector('[data-radix-dialog-default-open="true"] [aria-label="Close"]') as HTMLElement)?.click()}>{leaveApprovalsDict.closeButton}</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                      </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-2">
                       <Button size="sm" onClick={() => handleApprove(req.id)} disabled={isProcessing === req.id} className="w-full bg-green-600 hover:bg-green-700 text-white">
                        {isProcessing === req.id && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> {leaveApprovalsDict.approveButton}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openRejectDialog(req)} disabled={isProcessing === req.id} className="w-full border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive">
                        {isProcessing === req.id && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        <XCircle className="mr-1.5 h-3.5 w-3.5" /> {leaveApprovalsDict.rejectButton}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Reject Reason Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{leaveApprovalsDict.rejectDialog.title.replace('{employee}', requestToReject?.displayName || requestToReject?.username || '')}</DialogTitle>
            <DialogDescription>{leaveApprovalsDict.rejectDialog.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid w-full gap-1.5">
              <Label htmlFor="rejectionReason">{leaveApprovalsDict.rejectDialog.reasonLabel}</Label>
              <Textarea id="rejectionReason" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder={leaveApprovalsDict.rejectDialog.reasonPlaceholder} rows={3} disabled={!!isProcessing}/>
               {rejectionReason.trim().length === 0 && <p className="text-xs text-destructive">{leaveApprovalsDict.toast.reasonRequired}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsRejectDialogOpen(false)} disabled={!!isProcessing}>{leaveApprovalsDict.cancelButton}</Button>
            <Button type="button" onClick={handleReject} disabled={!!isProcessing || !rejectionReason.trim()} className="bg-destructive hover:bg-destructive/90">
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {leaveApprovalsDict.rejectDialog.confirmButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
