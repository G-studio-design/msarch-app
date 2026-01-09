'use client';

// src/components/dashboard/AttendanceReportClient.tsx
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, AlertTriangle, BarChart2, Plane, CalendarOff } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { getDictionary } from '@/lib/translations';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, eachDayOfInterval, isWithinInterval } from 'date-fns';
import { id as idLocale, enUS as enLocale } from 'date-fns/locale';
import { getMonthlyAttendanceReportData, type AttendanceRecord } from '@/services/attendance-service';
import { getAllUsersForDisplay } from '@/services/user-service';
import type { User } from '@/types/user-types';
import { getApprovedLeaveRequests } from '@/services/leave-request-service';
import type { LeaveRequest } from '@/types/leave-request-types';
import { getAllHolidays, type HolidayEntry } from '@/services/holiday-service';
import { Card as ResponsiveCard } from '@/components/ui/card';

const defaultDict = getDictionary('en');

interface CombinedEvent {
  type: 'attendance' | 'leave' | 'absent';
  date: string;
  user: User;
  data?: AttendanceRecord | LeaveRequest;
}


interface ReportData {
  users: Omit<User, 'password'>[];
  summary: { [userId: string]: { present: number; late: number; on_leave: number; absent: number; } };
  events: CombinedEvent[];
  holidays: HolidayEntry[];
  monthName: string;
  year: string;
  month: number;
}

interface AttendanceReportClientProps {
    attendanceEnabled: boolean;
}

export default function AttendanceReportClient({ attendanceEnabled }: AttendanceReportClientProps) {
  const { currentUser } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const [isClient, setIsClient] = React.useState(false);
  React.useEffect(() => { setIsClient(true) }, []);

  const [dict, setDict] = React.useState(defaultDict.attendanceReportPage);
  const [dictGlobal, setDictGlobal] = React.useState(defaultDict);

  const currentMonth = (new Date().getMonth() + 1).toString();
  const currentYear = new Date().getFullYear().toString();

  const [selectedMonth, setSelectedMonth] = React.useState<string>(currentMonth);
  const [selectedYear, setSelectedYear] = React.useState<string>(currentYear);
  
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [reportData, setReportData] = React.useState<ReportData | null>(null);

  React.useEffect(() => {
    const newDictData = getDictionary(language);
    setDict(newDictData.attendanceReportPage);
    setDictGlobal(newDictData);
  }, [language]);


  const canViewPage = currentUser && currentUser.roles && (currentUser.roles.includes('Owner') || currentUser.roles.includes('Admin Developer'));

  const getMonthName = React.useCallback((monthNumber: number) => {
    const date = new Date();
    date.setMonth(monthNumber - 1);
    const locale = language === 'id' ? idLocale : enLocale;
    return format(date, 'MMMM', { locale });
  }, [language]);

  const years = Array.from({ length: 5 }, (_, i) => (parseInt(currentYear) - i).toString());
  const months = Array.from({ length: 12 }, (_, i) => ({ value: (i + 1).toString(), label: getMonthName(i + 1) }));
  
  const handleGenerateReport = async () => {
    if (!selectedMonth || !selectedYear) {
      toast({ variant: 'destructive', title: dict.toast.error, description: dict.toast.selectMonthYear });
      return;
    }
    setIsGenerating(true);
    setReportData(null);
    try {
      const monthInt = parseInt(selectedMonth, 10);
      const yearInt = parseInt(selectedYear, 10);
      
      const [records, users, allApprovedLeave, allHolidays] = await Promise.all([
        getMonthlyAttendanceReportData(monthInt, yearInt),
        getAllUsersForDisplay(),
        getApprovedLeaveRequests(),
        getAllHolidays()
      ]);

      const reportInterval = { start: new Date(yearInt, monthInt - 1, 1), end: new Date(yearInt, monthInt, 0) };
      const monthlyHolidays = allHolidays.filter(h => isWithinInterval(parseISO(h.date), reportInterval));
      const monthlyLeaves = allApprovedLeave.filter(l => 
          isWithinInterval(parseISO(l.startDate), reportInterval) ||
          isWithinInterval(parseISO(l.endDate), reportInterval) ||
          (parseISO(l.startDate) < reportInterval.start && parseISO(l.endDate) > reportInterval.end)
      );

      const userStats: { [userId: string]: { present: number; late: number; on_leave: number; absent: number; } } = {};
      users.forEach(u => { userStats[u.id] = { present: 0, late: 0, on_leave: 0, absent: 0 }; });

      records.forEach(r => {
        if (userStats[r.userId]) {
          if (r.status === 'Present') userStats[r.userId].present++;
          if (r.status === 'Late') userStats[r.userId].late++;
        }
      });
      
      monthlyLeaves.forEach(leave => {
          if (userStats[leave.userId]) {
              eachDayOfInterval({ start: parseISO(leave.startDate), end: parseISO(leave.endDate) })
              .forEach(day => { if (isWithinInterval(day, reportInterval)) { userStats[leave.userId].on_leave++; }});
          }
      });
      
      // Calculate absent days
      const daysInMonth = eachDayOfInterval(reportInterval);
      users.forEach(user => {
        daysInMonth.forEach(day => {
          const dayOfWeek = day.getDay();
          const isWorkDay = dayOfWeek !== 0; // Simple: Sun=off
          if (!isWorkDay) return;

          const dateStr = format(day, 'yyyy-MM-dd');
          const isHoliday = monthlyHolidays.some(h => h.date === dateStr);
          if (isHoliday) return;

          const isOnLeave = monthlyLeaves.some(l => l.userId === user.id && isWithinInterval(day, {start: parseISO(l.startDate), end: parseISO(l.endDate)}));
          if (isOnLeave) return;

          const hasAttendance = records.some(r => r.userId === user.id && r.date === dateStr);
          if (!hasAttendance) {
            userStats[user.id].absent++;
          }
        });
      });

      const eventMap = new Map<string, CombinedEvent>();
      records.forEach(rec => {
        const user = users.find(u => u.id === rec.userId);
        if (user) eventMap.set(`${rec.userId}-${rec.date}`, { type: 'attendance', date: rec.date, user, data: rec });
      });
      monthlyLeaves.forEach(leave => {
        const user = users.find(u => u.id === leave.userId);
        if (user) {
            eachDayOfInterval({start: parseISO(leave.startDate), end: parseISO(leave.endDate)}).forEach(day => {
                if (isWithinInterval(day, reportInterval)) {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    if (!eventMap.has(`${user.id}-${dateStr}`)) eventMap.set(`${user.id}-${dateStr}`, { type: 'leave', date: dateStr, user, data: leave });
                }
            });
        }
      });
      users.forEach(user => {
        daysInMonth.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            if (day.getDay() !== 0 && !monthlyHolidays.some(h => h.date === dateStr) && !eventMap.has(`${user.id}-${dateStr}`)) {
                eventMap.set(`${user.id}-${dateStr}`, { type: 'absent', date: dateStr, user });
            }
        });
      });


      const combinedEvents = Array.from(eventMap.values()).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime() || (a.user.displayName || a.user.username).localeCompare(b.user.displayName || b.user.username));

      setReportData({
        users,
        summary: userStats,
        events: combinedEvents,
        holidays: monthlyHolidays,
        monthName: getMonthName(monthInt),
        year: selectedYear,
        month: monthInt,
      });

      if (combinedEvents.length === 0) {
        toast({ title: dict.toast.noDataTitle, description: dict.toast.noDataDesc });
      }

    } catch (error: any) {
      toast({ variant: 'destructive', title: dict.toast.error, description: error.message || dict.toast.generationFailed });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!reportData) {
      toast({ variant: 'destructive', title: dict.toast.error, description: dict.toast.generateFirst });
      return;
    }
    setIsDownloading(true);
    try {
      const response = await fetch('/api/generate-report/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: reportData.month,
          year: parseInt(reportData.year, 10),
          monthName: reportData.monthName,
          language,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || dict.toast.generationFailed);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_report_${reportData.year}_${reportData.monthName.replace(/ /g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: dict.toast.success, description: dict.toast.downloadStarted });
    } catch (error: any) {
      toast({ variant: 'destructive', title: dict.toast.error, description: error.message });
    } finally {
      setIsDownloading(false);
    }
  };
  
  const formatTimeOnly = (isoString?: string): string => {
    if (!isoString) return '--:--';
    try {
      return format(parseISO(isoString), 'HH:mm:ss');
    } catch (e) {
      return 'Invalid';
    }
  };

  if (!isClient) {
    return (
        <div className="container mx-auto py-4 px-4 md:px-6 space-y-6">
            <Skeleton className="h-8 w-1/3" />
            <Card><CardContent className="pt-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
        </div>
    );
  }

  const featureIsEnabledForUser = attendanceEnabled || (currentUser && currentUser.roles.includes('Admin Developer'));
  if (!canViewPage || !featureIsEnabledForUser) {
    return (
      <div className="container mx-auto py-4 px-4 md:px-6">
        <Card className="border-destructive">
          <CardHeader><CardTitle className="text-destructive">{dict.accessDenied}</CardTitle></CardHeader>
          <CardContent><p>{dict.accessDeniedDesc}</p></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 px-4 md:px-6 space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold text-primary">{dict.title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{dict.generateTitle}</CardTitle>
          <CardDescription>{dict.generateDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="month-select">{dict.monthLabel}</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger id="month-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="year-select">{dict.yearLabel}</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger id="year-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerateReport} disabled={isGenerating} className="accent-teal">
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChart2 className="mr-2 h-4 w-4" />}
              {isGenerating ? dict.generatingButton : dict.generateButton}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {reportData && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{dict.reportTitle} - {reportData.monthName} {reportData.year}</CardTitle>
              <CardDescription>{dict.summaryTitle}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Desktop View */}
              <div className="hidden md:block w-full overflow-x-auto rounded-md border">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{dict.tableHeaderEmployee}</TableHead>
                      <TableHead className="text-center">{dict.tableHeaderPresent}</TableHead>
                      <TableHead className="text-center">{dict.tableHeaderLate}</TableHead>
                      <TableHead className="text-center">{dict.tableHeaderOnLeave}</TableHead>
                      <TableHead className="text-center">{dict.tableHeaderAbsent}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.users.map(user => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.displayName || user.username}</TableCell>
                        <TableCell className="text-center">{reportData.summary[user.id]?.present || 0}</TableCell>
                        <TableCell className="text-center">{reportData.summary[user.id]?.late || 0}</TableCell>
                        <TableCell className="text-center">{reportData.summary[user.id]?.on_leave || 0}</TableCell>
                        <TableCell className="text-center">{reportData.summary[user.id]?.absent || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
               {/* Mobile View */}
              <div className="grid gap-4 md:hidden">
                {reportData.users.map(user => (
                  <ResponsiveCard key={`mobile-summary-${user.id}`}>
                    <CardHeader>
                      <CardTitle className="text-base">{user.displayName || user.username}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="flex justify-between"><span>{dict.tableHeaderPresent}:</span> <span className="font-bold">{reportData.summary[user.id]?.present || 0}</span></div>
                      <div className="flex justify-between"><span>{dict.tableHeaderLate}:</span> <span className="font-bold">{reportData.summary[user.id]?.late || 0}</span></div>
                      <div className="flex justify-between"><span>{dict.tableHeaderOnLeave}:</span> <span className="font-bold">{reportData.summary[user.id]?.on_leave || 0}</span></div>
                      <div className="flex justify-between"><span>{dict.tableHeaderAbsent}:</span> <span className="font-bold">{reportData.summary[user.id]?.absent || 0}</span></div>
                    </CardContent>
                  </ResponsiveCard>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>{dict.detailedLogTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              {reportData.events.length > 0 ? (
                <>
                  {/* Desktop View */}
                  <div className="hidden md:block w-full overflow-x-auto rounded-md border">
                    <Table className="min-w-[700px]">
                      <TableCaption>{dict.reportFor} {reportData.monthName} {reportData.year}</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{dict.detailHeaderDate}</TableHead>
                          <TableHead>{dict.detailHeaderEmployee}</TableHead>
                          <TableHead>{dict.detailHeaderCheckIn}</TableHead>
                          <TableHead>{dict.detailHeaderCheckOut}</TableHead>
                          <TableHead>{dict.detailHeaderStatus}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.events.map(event => (
                          <TableRow key={`${event.user.id}-${event.date}`}>
                            <TableCell>{format(parseISO(event.date), 'PP', { locale: language === 'id' ? idLocale : enLocale })}</TableCell>
                            <TableCell>{event.user.displayName}</TableCell>
                            {event.type === 'attendance' ? (
                                <>
                                  <TableCell>{formatTimeOnly((event.data as AttendanceRecord).checkInTime)}</TableCell>
                                  <TableCell>{formatTimeOnly((event.data as AttendanceRecord).checkOutTime)}</TableCell>
                                  <TableCell>{dictGlobal.attendancePage.status[(event.data as AttendanceRecord).status.toLowerCase() as keyof typeof dictGlobal.attendancePage.status] || (event.data as AttendanceRecord).status}</TableCell>
                                </>
                            ) : event.type === 'leave' ? (
                                <TableCell colSpan={3} className="text-center text-blue-600 italic">
                                    <div className="flex items-center justify-center gap-2">
                                      <Plane className="h-4 w-4"/> 
                                      <span>{dictGlobal.leaveRequestPage.leaveTypes[(event.data as LeaveRequest).leaveType.toLowerCase().replace(/ /g, '') as keyof typeof dictGlobal.leaveRequestPage.leaveTypes] || (event.data as LeaveRequest).leaveType}</span>
                                    </div>
                                </TableCell>
                            ) : (
                                 <TableCell colSpan={3} className="text-center text-red-600 italic">
                                    {dict.tableHeaderAbsent}
                                 </TableCell>
                            )}
                          </TableRow>
                        ))}
                         {reportData.holidays.map(holiday => (
                             <TableRow key={holiday.id} className="bg-fuchsia-50 dark:bg-fuchsia-900/30">
                                <TableCell>{format(parseISO(holiday.date), 'PP', { locale: language === 'id' ? idLocale : enLocale })}</TableCell>
                                <TableCell colSpan={4} className="text-center text-fuchsia-600 italic">
                                   <div className="flex items-center justify-center gap-2">
                                    <CalendarOff className="h-4 w-4"/>
                                    <span>{dictGlobal.dashboardPage.holidayLabel}: {holiday.name}</span>
                                   </div>
                                </TableCell>
                             </TableRow>
                         ))}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Mobile View */}
                  <div className="grid gap-4 md:hidden">
                    {reportData.events.map(event => (
                      <ResponsiveCard key={`mobile-detail-${event.user.id}-${event.date}`}>
                        <CardHeader>
                          <CardTitle className="text-base">{event.user.displayName}</CardTitle>
                          <CardDescription>{format(parseISO(event.date), 'PP', { locale: language === 'id' ? idLocale : enLocale })}</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                          {event.type === 'attendance' ? (
                              <>
                                <div><span className="font-semibold">{dict.detailHeaderCheckIn}:</span> {formatTimeOnly((event.data as AttendanceRecord).checkInTime)}</div>
                                <div><span className="font-semibold">{dict.detailHeaderCheckOut}:</span> {formatTimeOnly((event.data as AttendanceRecord).checkOutTime)}</div>
                                <div><span className="font-semibold">{dict.detailHeaderStatus}:</span> {dictGlobal.attendancePage.status[(event.data as AttendanceRecord).status.toLowerCase() as keyof typeof dictGlobal.attendancePage.status] || (event.data as AttendanceRecord).status}</div>
                              </>
                          ) : event.type === 'leave' ? (
                              <div className="flex items-center gap-2 text-blue-600 italic">
                                <Plane className="h-4 w-4"/>
                                <span>{dictGlobal.leaveRequestPage.leaveTypes[(event.data as LeaveRequest).leaveType.toLowerCase().replace(/ /g, '') as keyof typeof dictGlobal.leaveRequestPage.leaveTypes] || (event.data as LeaveRequest).leaveType}</span>
                              </div>
                          ) : (
                              <div className="text-red-600 italic">{dict.tableHeaderAbsent}</div>
                          )}
                        </CardContent>
                      </ResponsiveCard>
                    ))}
                    {reportData.holidays.map(holiday => (
                        <ResponsiveCard key={`mobile-holiday-${holiday.id}`} className="bg-fuchsia-50 dark:bg-fuchsia-900/30">
                          <CardContent className="pt-6 text-center text-fuchsia-600 italic">
                             <div className="flex items-center justify-center gap-2">
                              <CalendarOff className="h-4 w-4"/>
                              <span>{holiday.name} ({format(parseISO(holiday.date), 'PP', { locale: language === 'id' ? idLocale : enLocale })})</span>
                             </div>
                          </CardContent>
                        </ResponsiveCard>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  <p>{dict.toast.noDataDesc}</p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={handleDownload} disabled={isDownloading}>
                {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {isDownloading ? dict.downloadingButton : dict.downloadButton}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
