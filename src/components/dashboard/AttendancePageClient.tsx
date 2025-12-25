'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn, LogOut, CheckCircle, Clock, MapPin, Briefcase, Plane, AlertTriangle, PartyPopper } from 'lucide-react';
import { useDictionary } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, isSameDay, isWithinInterval, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';
import { id as IndonesianLocale, enUS as EnglishLocale } from 'date-fns/locale';
import { Calendar } from "@/components/ui/calendar";
import { type AppSettings } from '@/services/settings-service';
import type { LeaveRequest } from '@/types/leave-request-types';
import type { HolidayEntry } from '@/services/holiday-service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import type { AttendanceRecord, CheckInResult, CheckOutResult } from '@/services/attendance-service';

type DayOfWeek = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";
const daysOfWeek: DayOfWeek[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

interface AttendancePageClientProps {
    initialData: {
        attendanceEnabled: boolean;
        settings: AppSettings;
        leaves: LeaveRequest[];
        holidays: HolidayEntry[];
    }
}

export default function AttendancePageClient({ initialData }: AttendancePageClientProps) {
  const { currentUser } = useAuth();
  const dict = useDictionary();
  const { attendancePage: dictAttendance } = dict;

  const { toast } = useToast();
  
  const [isClient, setIsClient] = React.useState(false);
  React.useEffect(() => { setIsClient(true) }, []);

  const { attendanceEnabled, settings: appSettings, leaves, holidays } = initialData;

  const [isLoading, setIsLoading] = React.useState(true);
  const [todaysRecord, setTodaysRecord] = React.useState<AttendanceRecord | null>(null);
  const [userHistory, setUserHistory] = React.useState<AttendanceRecord[]>([]);

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isCheckOutDialogOpen, setIsCheckOutDialogOpen] = React.useState(false);


  const fetchData = React.useCallback(async () => {
    if (currentUser) {
      setIsLoading(true);
      try {
        const [todayRes, historyRes] = await Promise.all([
          fetch(`/api/attendance/check-in`), // Incorrect, but will be handled
          fetch(`/api/attendance/check-in?userId=${currentUser.id}`), // Should be a dedicated endpoint
        ]);

        let today: AttendanceRecord | null = null;
        let history: AttendanceRecord[] = [];
        
        if (todayRes.ok) {
            const allToday: AttendanceRecord[] = await todayRes.json();
            today = allToday.find(r => r.userId === currentUser.id) || null;
        }

        if (historyRes.ok) {
            const allHistory: AttendanceRecord[] = await historyRes.json();
            history = allHistory.filter(r => r.userId === currentUser.id);
        }
        
        setTodaysRecord(today);
        setUserHistory(history);

      } catch (error: any) {
        toast({ variant: 'destructive', title: dictAttendance.toast.errorTitle, description: error.message });
      } finally {
        setIsLoading(false);
      }
    }
  }, [currentUser, toast, dictAttendance]);

  React.useEffect(() => {
    const featureIsEnabledForUser = attendanceEnabled || (currentUser && currentUser.roles.includes('Admin Developer'));
    if (isClient && featureIsEnabledForUser) {
      fetchData();
    } else if (isClient) {
      setIsLoading(false);
    }
  }, [attendanceEnabled, fetchData, currentUser, isClient]);

  const handleCheckIn = () => {
    if (!currentUser) return;
    setIsProcessing(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          const response = await fetch(`/api/attendance/check-in`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                username: currentUser.username,
                displayName: currentUser.displayName || currentUser.username,
                location: { latitude, longitude },
            }),
          });
          const result = await response.json() as CheckInResult;

          if (!response.ok || result.error) {
             toast({ variant: 'destructive', title: dictAttendance.toast.errorTitle, description: result.error });
          } else if (result.record) {
            setTodaysRecord(result.record);
            toast({
              title: dictAttendance.toast.checkInSuccessTitle,
              description: `${dictAttendance.toast.checkInSuccessDesc} ${format(new Date(result.record.checkInTime!), 'HH:mm')}`,
            });
          }
        } catch (error: any) {
          console.error("Client-side check-in error:", error);
          toast({ variant: 'destructive', title: dictAttendance.toast.errorTitle, description: "Terjadi kesalahan pada aplikasi. Silakan coba lagi." });
        } finally {
          setIsProcessing(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast({
          variant: 'destructive',
          title: dictAttendance.toast.errorTitle,
          description: error.message.includes("User denied Geolocation")
            ? "Izin lokasi diperlukan untuk absensi."
            : "Gagal mendapatkan lokasi.",
        });
        setIsProcessing(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };
  
  const handleCheckOutClick = () => {
    const now = new Date();
    const currentDayKey = daysOfWeek[now.getDay()];
    const workDayInfo = appSettings?.workingHours[currentDayKey];

    if (workDayInfo && workDayInfo.isWorkDay) {
        const standardCheckOutTime = workDayInfo.checkOut || "17:00";
        const [hour, minute] = standardCheckOutTime.split(':').map(Number);
        const standardCheckOutTimeToday = new Date();
        standardCheckOutTimeToday.setHours(hour, minute, 0, 0);

        if (now < standardCheckOutTimeToday) {
            setIsCheckOutDialogOpen(true);
        } else {
            performCheckOut('Normal');
        }
    } else {
        // Not a workday, allow normal checkout without a reason dialog
        performCheckOut('Normal');
    }
  };
  
  const performCheckOut = async (reason: 'Normal' | 'Survei' | 'Sidang') => {
    if (!currentUser) return;
    setIsProcessing(true);
    setIsCheckOutDialogOpen(false);
    try {
      const response = await fetch(`/api/attendance/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, reason }),
      });
      const result = await response.json() as CheckOutResult;

      if (!response.ok || result.error) {
        toast({ variant: 'destructive', title: dictAttendance.toast.errorTitle, description: result.error });
      } else if (result.record) {
        setTodaysRecord(result.record);
        toast({ title: dictAttendance.toast.checkOutSuccessTitle, description: `${dictAttendance.toast.checkOutSuccessDesc} ${format(parseISO(result.record.checkOutTime!), 'HH:mm')}` });
      }
    } catch (error: any) {
      console.error("Client-side check-out error:", error);
      toast({ variant: 'destructive', title: dictAttendance.toast.errorTitle, description: "Terjadi kesalahan pada aplikasi. Silakan coba lagi." });
    } finally {
      setIsProcessing(false);
    }
  };

  const attendanceModifiers = React.useMemo(() => {
    const modifiers: Record<string, Date[]> = {
      present: [],
      late: [],
      on_leave: [],
      holiday: [],
    };
    userHistory.forEach(rec => {
      if (rec.status === 'Present') modifiers.present.push(parseISO(rec.date));
      if (rec.status === 'Late') modifiers.late.push(parseISO(rec.date));
    });
    // Populate leave days for the current user
    leaves.forEach(l => {
        if (l.userId === currentUser?.id) {
            eachDayOfInterval({start: parseISO(l.startDate), end: parseISO(l.endDate)}).forEach(day => {
                modifiers.on_leave.push(day);
            });
        }
    });
    // Populate holidays
    holidays.forEach(h => {
        modifiers.holiday.push(parseISO(h.date));
    });

    return modifiers;
  }, [userHistory, leaves, holidays, currentUser]);
  
  const currentLocale = dict.language === 'id' ? IndonesianLocale : EnglishLocale;
  const today = new Date();
  const todayKey = daysOfWeek[today.getDay()];
  const isWorkDayToday = appSettings?.workingHours[todayKey]?.isWorkDay ?? true;
  
  const isTodayHoliday = holidays.some(h => isSameDay(parseISO(h.date), today));
  const isTodayOnLeave = leaves.some(l => l.userId === currentUser?.id && isWithinInterval(today, { start: startOfDay(parseISO(l.startDate)), end: endOfDay(parseISO(l.endDate)) }));


  // Render logic
  if (!isClient) {
      return (
          <div className="container mx-auto py-4 px-4 md:px-6 space-y-6">
              <Skeleton className="h-8 w-1/3 mb-4" />
              <div className="grid gap-6 md:grid-cols-2">
                  <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-24 w-full" /></CardContent></Card>
                  <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
              </div>
          </div>
      );
  }


  const featureIsEnabledForUser = attendanceEnabled || (currentUser && currentUser.roles.includes('Admin Developer'));
  if (!featureIsEnabledForUser) {
    return (
      <div className="container mx-auto py-4 px-4 md:px-6">
        <Card className="border-destructive">
          <CardHeader><CardTitle className="text-destructive">Fitur Dinonaktifkan</CardTitle></CardHeader>
          <CardContent><p>Fitur absensi saat ini tidak diaktifkan oleh administrator.</p></CardContent>
        </Card>
      </div>
    );
  }

  if (!currentUser) {
    return (
        <div className="container mx-auto py-4 px-4 md:px-6 space-y-6">
              <Skeleton className="h-8 w-1/3 mb-4" />
              <div className="grid gap-6 md:grid-cols-2">
                  <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-24 w-full" /></CardContent></Card>
                  <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
              </div>
          </div>
    );
  }

  return (
    <div className="container mx-auto py-4 px-4 md:px-6 space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold text-primary">{dictAttendance.title}</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{dictAttendance.todayTitle}</CardTitle>
            <CardDescription>{format(new Date(), 'eeee, dd MMMM yyyy', { locale: currentLocale })}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : todaysRecord ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary">
                  {todaysRecord.status === 'Late' ? <Clock className="h-6 w-6 text-orange-500" /> : <CheckCircle className="h-6 w-6 text-green-500" />}
                  <div>
                    <p className="font-semibold">{dictAttendance.statusLabel}: {dictAttendance.status[todaysRecord.status.toLowerCase() as keyof typeof dictAttendance.status]}</p>
                    <p className="text-sm text-muted-foreground">{dictAttendance.checkInTimeLabel}: {format(parseISO(todaysRecord.checkInTime!), 'HH:mm:ss')}</p>
                  </div>
                </div>
                {todaysRecord.checkOutTime ? (
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary">
                    <LogOut className="h-6 w-6 text-primary" />
                    <div>
                      <p className="font-semibold">{dictAttendance.checkOutTimeLabel}: {format(parseISO(todaysRecord.checkOutTime), 'HH:mm:ss')}</p>
                      {todaysRecord.checkOutReason && todaysRecord.checkOutReason !== 'Normal' && (
                         <p className="text-sm text-muted-foreground">{dictAttendance.checkOutReasonLabel}: {todaysRecord.checkOutReason}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <Button onClick={handleCheckOutClick} disabled={isProcessing} className="w-full accent-teal">
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                    {dictAttendance.checkOutButton}
                  </Button>
                )}
                 {todaysRecord.location && 
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{dictAttendance.checkInLocation}: {todaysRecord.location.latitude.toFixed(4)}, {todaysRecord.location.longitude.toFixed(4)}</span>
                  </div>
                }
              </div>
            ) : isTodayHoliday ? (
              <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary text-muted-foreground">
                <PartyPopper className="h-6 w-6 text-fuchsia-500"/>
                <div>
                  <p className="font-semibold">{holidays.find(h => isSameDay(parseISO(h.date), today))?.name || "Hari Libur"}</p>
                  <p className="text-sm">Tidak perlu absensi hari ini.</p>
                </div>
              </div>
            ) : isTodayOnLeave ? (
              <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary text-muted-foreground">
                <Plane className="h-6 w-6 text-blue-500"/>
                <div>
                  <p className="font-semibold">Anda Sedang Izin</p>
                  <p className="text-sm">Permintaan izin Anda telah disetujui.</p>
                </div>
              </div>
            ) : !isWorkDayToday ? (
              <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary text-muted-foreground">
                <Briefcase className="h-6 w-6" />
                <div>
                  <p className="font-semibold">Hari Libur Kerja</p>
                  <p className="text-sm">Tidak perlu absensi hari ini sesuai jadwal kerja.</p>
                </div>
              </div>
            ) : (
                <Button onClick={handleCheckIn} disabled={isProcessing} className="w-full">
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                  {dictAttendance.checkInButton}
                </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{dictAttendance.historyTitle}</CardTitle>
            <CardDescription>{dictAttendance.historyDesc}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
             <Calendar
                mode="single"
                modifiers={attendanceModifiers}
                modifiersClassNames={{
                  present: "bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded-full",
                  late: "bg-orange-100 dark:bg-orange-800 text-orange-800 dark:text-orange-200 rounded-full",
                  on_leave: "bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-full",
                  holiday: "bg-fuchsia-100 dark:bg-fuchsia-800 text-fuchsia-800 dark:text-fuchsia-200 rounded-full",
                }}
                locale={currentLocale}
              />
          </CardContent>
        </Card>
      </div>
      
      <Dialog open={isCheckOutDialogOpen} onOpenChange={setIsCheckOutDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>{dictAttendance.checkOutDialog.title}</DialogTitle>
                  <DialogDescription>{dictAttendance.checkOutDialog.description}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-3 py-4">
                  <Button onClick={() => performCheckOut('Normal')} variant="outline" disabled={isProcessing}>
                    <LogOut className="mr-2 h-4 w-4" /> {dictAttendance.checkOutDialog.normalButton}
                  </Button>
                  <Button onClick={() => performCheckOut('Survei')} variant="outline" disabled={isProcessing}>
                    <MapPin className="mr-2 h-4 w-4" /> {dictAttendance.checkOutDialog.surveyButton}
                  </Button>
                  <Button onClick={() => performCheckOut('Sidang')} variant="outline" disabled={isProcessing}>
                    <Briefcase className="mr-2 h-4 w-4" /> {dictAttendance.checkOutDialog.sidangButton}
                  </Button>
              </div>
              <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsCheckOutDialogOpen(false)} disabled={isProcessing}>{dictAttendance.checkOutDialog.cancelButton}</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
