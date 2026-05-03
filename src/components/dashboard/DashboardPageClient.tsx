'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { getDictionary } from '@/lib/translations';
import type { Project } from '@/types/project-types';
import type { LeaveRequest } from '@/types/leave-request-types';
import type { HolidayEntry } from '@/services/holiday-service';
import Link from 'next/link';
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, startOfToday, isSameDay, addDays, isWithinInterval, endOfDay, startOfDay } from 'date-fns';
import { id as idLocale, enUS as enLocale } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';
import {
    PlusCircle,
    Briefcase,
    CalendarClock,
    MapPin,
    Plane,
    Wrench,
    Code,
    User as UserIcon,
    PartyPopper,
    Building,
    UserCheck,
    UserX,
    Loader2,
    CheckCircle,
    Clock
} from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LabelList, Cell } from "recharts";
import { getAllProjects } from '@/services/project-service';
import { getApprovedLeaveRequests } from '@/services/leave-request-service';
import { getAllHolidays } from '@/services/holiday-service';
import { getAllUsersForDisplay } from '@/services/user-service';
import { getTodaysAttendanceForAllUsers } from '@/services/attendance-service';
import { getAppSettings } from '@/services/settings-service';
import { Skeleton } from '@/components/ui/skeleton';


// Unified event type for the calendar
type CalendarEventType = 'sidang' | 'survey' | 'leave' | 'holiday' | 'company_event';
interface UnifiedEvent {
    id: string;
    type: CalendarEventType;
    date: Date;
    title: string;
    time?: string;
    location?: string;
    description?: string;
}

// Helper function to determine bar color based on progress
const getProgressColor = (progress: number, status: string): string => {
    if (status === 'Canceled') return 'hsl(240 4.8% 95.9%)';
    if (progress === 100) return 'hsl(142.1 76.2% 36.3%)';
    if (progress >= 70) return 'hsl(221.2 83.2% 53.3%)';
    if (progress >= 30) return 'hsl(35.6 91.6% 56.5%)';
    return 'hsl(0 84.2% 60.2%)';
};

async function getDashboardData() {
  const [
    projects,
    leaveRequests,
    holidays,
    allUsers,
    todaysAttendance,
    settings,
  ] = await Promise.all([
    getAllProjects(),
    getApprovedLeaveRequests(),
    getAllHolidays(),
    getAllUsersForDisplay(),
    getTodaysAttendanceForAllUsers(),
    getAppSettings()
  ]);

  return {
    projects,
    leaveRequests,
    holidays,
    allUsers,
    todaysAttendance,
    attendanceEnabled: settings.feature_attendance_enabled,
  };
}

function DashboardSkeleton() {
    return (
      <div className="container mx-auto py-4 px-4 md:px-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <Skeleton className="h-10 w-2/5" />
          <Skeleton className="h-10 w-44" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card><CardHeader><Skeleton className="h-6 w-1/3 mb-2" /><Skeleton className="h-4 w-2/3" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
          </div>
          <div className="lg:col-span-1 space-y-6">
            <Card><CardHeader><Skeleton className="h-6 w-1/2 mb-2" /><Skeleton className="h-4 w-full" /></CardHeader><CardContent><Skeleton className="h-80 w-full" /></CardContent></Card>
          </div>
        </div>
      </div>
    );
}

export function DashboardPageClient({ initialData: _ }: { initialData: any }) {
  const { currentUser, isHydrated: isAuthHydrated } = useAuth();
  const { language } = useLanguage();
  const [data, setData] = useState<Awaited<ReturnType<typeof getDashboardData>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  const [todayDate, setTodayDate] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    setHasMounted(true);
    const now = new Date();
    setTodayDate(now);
    setSelectedDate(now);
    
    async function loadData() {
      setIsLoading(true);
      try {
          const fetchedData = await getDashboardData();
          setData(fetchedData);
      } catch (err) {
          console.error("Dashboard data load error:", err);
      } finally {
          setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const dashboardDict = useMemo(() => getDictionary(language).dashboardPage, [language]);
  const projectsDict = useMemo(() => getDictionary(language).projectsPage, [language]);
  const currentLocale = useMemo(() => language === 'id' ? idLocale : enLocale, [language]);

  const { projects = [], leaveRequests = [], holidays = [], allUsers = [], todaysAttendance = [], attendanceEnabled = false } = data || {};

  const { eventsByDate, upcomingEvents } = useMemo(() => {
    if (!hasMounted) return { eventsByDate: {}, upcomingEvents: [] };
    const eventMap: Record<string, UnifiedEvent[]> = {};
    const upcoming: UnifiedEvent[] = [];
    const today = startOfToday();
    const threeDaysFromNow = addDays(today, 3);

    projects.forEach(p => {
      if (p.scheduleDetails?.date && p.scheduleDetails?.time) {
        const eventDate = parseISO(`${p.scheduleDetails.date}T${p.scheduleDetails.time}`);
        const key = format(eventDate, 'yyyy-MM-dd');
        if (!eventMap[key]) eventMap[key] = [];
        eventMap[key].push({ id: `sidang-${p.id}`, type: 'sidang', date: eventDate, title: p.title, time: p.scheduleDetails.time, location: p.scheduleDetails.location });
      }
      if (p.surveyDetails?.date && p.surveyDetails?.time) {
        const eventDate = parseISO(`${p.surveyDetails.date}T${p.surveyDetails.time}`);
        const key = format(eventDate, 'yyyy-MM-dd');
        if (!eventMap[key]) eventMap[key] = [];
        eventMap[key].push({ id: `survey-${p.id}`, type: 'survey', date: eventDate, title: p.title, time: p.surveyDetails.time, description: p.surveyDetails.description });
      }
    });

    leaveRequests.forEach(l => {
      const start = parseISO(l.startDate);
      const end = parseISO(l.endDate);
      for (let day = start; day <= end; day = addDays(day, 1)) {
        const key = format(day, 'yyyy-MM-dd');
        if (!eventMap[key]) eventMap[key] = [];
        eventMap[key].push({ id: `leave-${l.id}-${key}`, type: 'leave', date: day, title: l.displayName || l.username, description: l.reason });
      }
    });

    holidays.forEach(h => {
        const eventDate = parseISO(h.date);
        const key = format(eventDate, 'yyyy-MM-dd');
        if (!eventMap[key]) eventMap[key] = [];
        eventMap[key].push({ id: `holiday-${h.id}`, type: 'holiday', date: eventDate, title: h.name, description: h.description });
    });

    Object.keys(eventMap).forEach(key => {
      eventMap[key].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      const date = parseISO(key);
      if (isWithinInterval(date, { start: today, end: threeDaysFromNow })) {
          upcoming.push(...eventMap[key].filter(e => e.type === 'sidang' || e.type === 'survey'));
      }
    });

    return { eventsByDate: eventMap, upcomingEvents: upcoming.sort((a,b) => a.date.getTime() - b.date.getTime()) };
  }, [projects, leaveRequests, holidays, hasMounted]);

  const attendanceSummary = useMemo(() => {
    if (!hasMounted || !todayDate) return { isHoliday: false, holidayName: null, checkedIn: 0, onLeave: 0, notCheckedIn: 0 };
    const todayHoliday = holidays.find(h => isSameDay(parseISO(h.date), todayDate));
    if (todayHoliday) return { isHoliday: true, holidayName: todayHoliday.name, checkedIn: 0, onLeave: 0, notCheckedIn: 0 };

    const onLeaveTodayCount = leaveRequests.filter(l => isWithinInterval(todayDate, { start: startOfDay(parseISO(l.startDate)), end: endOfDay(parseISO(l.endDate)) })).length;
    return {
      isHoliday: false,
      holidayName: null,
      checkedIn: todaysAttendance.length,
      onLeave: onLeaveTodayCount,
      notCheckedIn: Math.max(0, allUsers.length - todaysAttendance.length - onLeaveTodayCount),
    };
  }, [allUsers, todaysAttendance, leaveRequests, holidays, hasMounted, todayDate]);

  const activeProjects = useMemo(() => projects.filter(p => p.status !== 'Completed' && p.status !== 'Canceled'), [projects]);
  
  const getTranslatedStatus = useCallback((statusKey: string): string => {
    const key = (statusKey || '').toLowerCase().replace(/ /g,'') as keyof typeof dashboardDict.status;
    return dashboardDict.status[key] || statusKey;
  }, [dashboardDict]);
  
  const getEventTypeIcon = (type: CalendarEventType) => {
      switch(type) {
          case 'sidang': return <Briefcase className="h-4 w-4 text-primary" />;
          case 'survey': return <MapPin className="h-4 w-4 text-orange-500" />;
          case 'leave': return <Plane className="h-4 w-4 text-blue-500" />;
          case 'holiday': return <PartyPopper className="h-4 w-4 text-fuchsia-500" />;
          case 'company_event': return <Building className="h-4 w-4 text-teal-500" />;
          default: return <CheckCircle className="h-4 w-4 text-muted-foreground" />;
      }
  }

  const canAddProject = useMemo(() => {
    if (!currentUser?.roles) return false;
    return currentUser.roles.some(r => ['Owner', 'Admin Proyek', 'Admin Developer'].includes(r));
  }, [currentUser]);

  if (isLoading || !isAuthHydrated || !hasMounted) return <DashboardSkeleton />;

  return (
      <div className="container mx-auto py-4 px-4 md:px-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-primary">{dashboardDict.title}</h1>
          {canAddProject && (
              <Link href="/dashboard/add-project" passHref><Button className="w-full sm:w-auto accent-teal"><PlusCircle className="mr-2 h-5 w-5" />{dashboardDict.addNewProject}</Button></Link>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {(attendanceEnabled || currentUser?.roles.includes('Admin Developer')) && (
                <Card>
                    <CardHeader>
                        <CardTitle>{dashboardDict.attendanceSummary.title}</CardTitle>
                        <CardDescription suppressHydrationWarning>{todayDate ? format(todayDate, 'eeee, dd MMMM yyyy', { locale: currentLocale }) : ''}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {attendanceSummary.isHoliday ? (
                            <div className="flex items-center gap-3 text-muted-foreground p-4 bg-secondary rounded-lg"><PartyPopper className="h-8 w-8 text-fuchsia-500"/><div><p className="font-semibold text-foreground">{dashboardDict.attendanceSummary.holiday}</p><p className="text-sm">{attendanceSummary.holidayName}</p></div></div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="flex items-center gap-3"><UserCheck className="h-7 w-7 text-green-500" /><div><p className="text-lg font-bold">{attendanceSummary.checkedIn}</p><p className="text-xs text-muted-foreground">{dashboardDict.attendanceSummary.present}</p></div></div>
                                <div className="flex items-center gap-3"><Plane className="h-7 w-7 text-blue-500" /><div><p className="text-lg font-bold">{attendanceSummary.onLeave}</p><p className="text-xs text-muted-foreground">{dashboardDict.attendanceSummary.onLeave}</p></div></div>
                                <div className="flex items-center gap-3"><UserX className="h-7 w-7 text-red-500" /><div><p className="text-lg font-bold">{attendanceSummary.notCheckedIn}</p><p className="text-xs text-muted-foreground">{dashboardDict.attendanceSummary.absent}</p></div></div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader><CardTitle>{dashboardDict.activeProjects}</CardTitle><CardDescription>{dashboardDict.allProjectsDesc}</CardDescription></CardHeader>
                <CardContent>
                    {activeProjects.length === 0 ? <p className="text-muted-foreground">{dashboardDict.noProjects}</p> : (
                        <div className="space-y-4">
                            {activeProjects.slice(0, 4).map(project => (
                                <Link href={`/dashboard/projects?projectId=${project.id}`} key={project.id} passHref>
                                <Card className="hover:bg-accent/50 transition-colors cursor-pointer"><CardContent className="p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"><div className="flex-1 overflow-hidden w-full min-w-0"><p className="font-semibold truncate">{project.title}</p><p className="text-xs text-muted-foreground truncate">{projectsDict.nextActionLabel}: {project.nextAction || projectsDict.none}</p></div><div className="flex-shrink-0 flex items-center gap-2 w-full sm:w-auto"><Badge variant="outline" className="flex-shrink-0">{getTranslatedStatus(project.assignedDivision)}</Badge><Progress value={project.progress} className="w-full sm:w-20 h-2" /></div></CardContent></Card>
                                </Link>
                            ))}
                        </div>
                    )}
                </CardContent>
                <CardFooter><Link href="/dashboard/projects" passHref className="w-full"><Button variant="outline" className="w-full">View All Active Projects</Button></Link></CardFooter>
            </Card>

            <Card>
              <CardHeader><CardTitle>{dashboardDict.projectProgressChartTitle}</CardTitle><CardDescription>{dashboardDict.projectProgressChartDesc}</CardDescription></CardHeader>
              <CardContent className="pl-0 pr-4 sm:pl-2">
                {activeProjects.length > 0 ? (
                  <ChartContainer config={{ progress: { label: dashboardDict.progressChart.label } }} className="h-[300px] w-full">
                    <ResponsiveContainer>
                      <BarChart data={activeProjects} layout="vertical" margin={{ right: 40, left: 10 }}>
                        <XAxis type="number" dataKey="progress" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="title" tick={{ fontSize: 10, width: 80, textAnchor: 'end' }} interval={0} tickFormatter={(v) => v.length > 15 ? `${v.substring(0, 15)}...` : v} />
                        <ChartTooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltipContent />} />
                        <Bar dataKey="progress" radius={[0, 4, 4, 0]}>
                           <LabelList dataKey="progress" position="right" offset={8} className="fill-foreground" fontSize={12} formatter={(v: number) => `${v}%`} />
                           {activeProjects.map((p, i) => <Cell key={i} fill={getProgressColor(p.progress, p.status)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : <p className="text-sm text-muted-foreground">{dashboardDict.noProjectsForChart}</p>}
              </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>{dashboardDict.upcomingAgendaTitle}</CardTitle><CardDescription>{dashboardDict.upcomingAgendaDesc}</CardDescription></CardHeader>
                <CardContent>
                    {upcomingEvents.length === 0 ? <p className="text-sm text-muted-foreground">{dashboardDict.noUpcomingAgenda}</p> : (
                        <ul className="space-y-3">
                            {upcomingEvents.slice(0, 5).map(event => (
                                <li key={event.id} className="flex items-start gap-3"><div className="flex-shrink-0 mt-1">{getEventTypeIcon(event.type)}</div><div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{event.title}</p><p className="text-xs text-muted-foreground" suppressHydrationWarning>{format(event.date, 'eeee, MMM d', { locale: currentLocale })}{event.time ? ` @ ${event.time}` : ''}</p></div><Badge variant="secondary" className="capitalize flex-shrink-0">{dashboardDict.eventTypes[event.type]}</Badge></li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card>
                <CardHeader><CardTitle>{dashboardDict.scheduleAgendaTitle}</CardTitle><CardDescription>{dashboardDict.scheduleAgendaDesc}</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-center">
                        <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className="rounded-md border" locale={currentLocale} modifiers={{ hasEvent: Object.keys(eventsByDate).map(d => parseISO(d)) }} modifiersClassNames={{ hasEvent: "relative !bg-primary/10" }} />
                    </div>
                    <div className="space-y-3 pt-4 border-t h-48 overflow-y-auto pr-2">
                        <h3 className="text-md font-semibold" suppressHydrationWarning>{selectedDate ? `${dashboardDict.scheduleDetailsTitle} ${format(selectedDate, 'PPPP', { locale: currentLocale })}` : dashboardDict.selectDatePrompt}</h3>
                        {selectedDate && eventsByDate[format(selectedDate, 'yyyy-MM-dd')] ? (
                            eventsByDate[format(selectedDate, 'yyyy-MM-dd')].map(event => (
                                <div key={event.id} className="flex gap-3"><div className="flex-shrink-0 mt-1">{getEventTypeIcon(event.type)}</div><div><p className="text-sm font-medium leading-tight">{event.title}</p><p className="text-xs text-muted-foreground">{dashboardDict.eventTypes[event.type]}</p></div></div>
                            ))
                        ) : <p className="text-sm text-muted-foreground">{dashboardDict.noEventsOnDate}</p>}
                    </div>
                </CardContent>
            </Card>
          </div>
        </div>
      </div>
  );
}
