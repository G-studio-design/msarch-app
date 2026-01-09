'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn, LogOut, CheckCircle, Clock, MapPin, Briefcase, Plane, AlertTriangle, PartyPopper } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { getDictionary } from '@/lib/translations';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { checkIn, checkOut, getTodaysAttendance, getAttendanceForUser, type AttendanceRecord } from '@/services/attendance-service';
import { format, parseISO, isSameDay, isWithinInterval, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';
import { id as IndonesianLocale, enUS as EnglishLocale } from 'date-fns/locale';
import { Calendar } from "@/components/ui/calendar";
import { type AppSettings } from '@/services/settings-service';
import type { LeaveRequest } from '@/types/leave-request-types';
import type { HolidayEntry } from '@/services/holiday-service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const defaultDict = getDictionary('en');
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
  const { language } = useLanguage();
  const { toast } = useToast();
  
  const [isClient, setIsClient] = React.useState(false);
  React.useEffect(() => { setIsClient(true) }, []);

  const [dict, setDict] = React.useState(defaultDict.attendancePage);

  const { attendanceEnabled, settings: appSettings, leaves, holidays } = initialData;

  const [isLoading, setIsLoading] = React.useState(true);
  const [todaysRecord, setTodaysRecord] = React.useState<AttendanceRecord | null>(null);
  const [userHistory, setUserHistory] = React.useState<AttendanceRecord[]>([]);

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isCheckOutDialogOpen, setIsCheckOutDialogOpen] = React.useState(false);

  React.useEffect(() => {
    const newDictData = getDictionary(language);
    setDict(newDictData.attendancePage);
  }, [language]);


  const fetchData = React.useCallback(async () => {
    if (currentUser) {
      setIsLoading(true);
      try {
        const [today, history] = await Promise.all([
          getTodaysAttendance(currentUser.id),
          getAttendanceForUser(currentUser.id),
        ]);
        setTodaysRecord(today);
        setUserHistory(history);
      } catch (error: any) {
        toast({ variant: 'destructive', title: dict.toast.errorTitle, description: error.message });
      } finally {
        setIsLoading(false);
      }
    }
  }, [currentUser, toast, dict]);

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
          const result = await checkIn({
            userId: currentUser.id,
            username: currentUser.username,
            displayName: currentUser.displayName || currentUser.username,
            location: { latitude, longitude },
          });

          if (result.error) {
             toast({ variant: 'destructive', title: dict.toast.errorTitle, description: result.error });
          } else if (result.record) {
            setTodaysRecord(result.record);
            toast({
              title: dict.toast.checkInSuccessTitle,
              description: `${dict.toast.checkInSuccessDesc} ${format(new Date(result.record.checkInTime!), 'HH:mm')}`,
            });
          }
        } catch (error: any) {
          console.error("Client-side check-in error:", error);
          toast({ variant: 'destructive', title: dict.toast.errorTitle, description: "Terjadi kesalahan pada aplikasi. Silakan coba lagi." });
        } finally {
          setIsProcessing(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast({
          variant: 'destructive',
          title: dict.toast.errorTitle,
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
      const result = await checkOut(currentUser.id, reason);
      if (result.error) {
        toast({ variant: 'destructive', title: dict.toast.errorTitle, description: result.error });
      } else if (result.record) {
        setTodaysRecord(result.record);
        toast({ title: dict.toast.checkOutSuccessTitle, description: `${dict.toast.checkOutSuccessDesc} ${format(parseISO(result.record.checkOutTime!), 'HH:mm')}` });
      }
    } catch (error: any) {
      console.error("Client-side check-out error:", error);
      toast({ variant: 'destructive', title: dict.toast.errorTitle, description: "Terjadi kesalahan pada aplikasi. Silakan coba lagi." });
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
  
  const currentLocale = language === 'id' ? IndonesianLocale : EnglishLocale;
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
      <h1 className="text-2xl md:text-3xl font-bold text-primary">{dict.title}</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{dict.todayTitle}</CardTitle>
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
                    <p className="font-semibold">{dict.statusLabel}: {dict.status[todaysRecord.status.toLowerCase() as keyof typeof dict.status]}</p>
                    <p className="text-sm text-muted-foreground">{dict.checkInTimeLabel}: {format(parseISO(todaysRecord.checkInTime!), 'HH:mm:ss')}</p>
                  </div>
                </div>
                {todaysRecord.checkOutTime ? (
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary">
                    <LogOut className="h-6 w-6 text-primary" />
                    <div>
                      <p className="font-semibold">{dict.checkOutTimeLabel}: {format(parseISO(todaysRecord.checkOutTime), 'HH:mm:ss')}</p>
                      {todaysRecord.checkOutReason && todaysRecord.checkOutReason !== 'Normal' && (
                         <p className="text-sm text-muted-foreground">{dict.checkOutReasonLabel}: {todaysRecord.checkOutReason}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <Button onClick={handleCheckOutClick} disabled={isProcessing} className="w-full accent-teal">
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                    {dict.checkOutButton}
                  </Button>
                )}
                 {todaysRecord.location && 
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{dict.checkInLocation}: {todaysRecord.location.latitude.toFixed(4)}, {todaysRecord.location.longitude.toFixed(4)}</span>
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
                  {dict.checkInButton}
                </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{dict.historyTitle}</CardTitle>
            <CardDescription>{dict.historyDesc}</CardDescription>
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
                  <DialogTitle>{dict.checkOutDialog.title}</DialogTitle>
                  <DialogDescription>{dict.checkOutDialog.description}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-3 py-4">
                  <Button onClick={() => performCheckOut('Normal')} variant="outline" disabled={isProcessing}>
                    <LogOut className="mr-2 h-4 w-4" /> {dict.checkOutDialog.normalButton}
                  </Button>
                  <Button onClick={() => performCheckOut('Survei')} variant="outline" disabled={isProcessing}>
                    <MapPin className="mr-2 h-4 w-4" /> {dict.checkOutDialog.surveyButton}
                  </Button>
                  <Button onClick={() => performCheckOut('Sidang')} variant="outline" disabled={isProcessing}>
                    <Briefcase className="mr-2 h-4 w-4" /> {dict.checkOutDialog.sidangButton}
                  </Button>
              </div>
              <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsCheckOutDialogOpen(false)} disabled={isProcessing}>{dict.checkOutDialog.cancelButton}</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
