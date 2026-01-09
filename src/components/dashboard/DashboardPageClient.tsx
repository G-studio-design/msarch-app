// src/components/dashboard/DashboardPageClient.tsx
'use client';

import React, { useState, useMemo, useCallback, Suspense, useEffect } from 'react';
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
import type { User } from '@/types/user-types';
import type { AttendanceRecord } from '@/services/attendance-service';
import Link from 'next/link';
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, startOfToday, isSameDay, addDays, isWithinInterval, endOfDay } from 'date-fns';
import { id as idLocale, enUS as enLocale } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';
import {
    AlertTriangle,
    CheckCircle,
    Clock,
    PlusCircle,
    Briefcase,
    CalendarClock,
    MapPin,
    Plane,
    Wrench,
    Code,
    User as UserIcon,
    UserCog,
    PartyPopper,
    Building,
    UserCheck,
    UserX,
    Loader2,
    ArrowRight
} from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LabelList, Cell } from "recharts";
import { getAllProjects } from '../../services/project-service';
import { getApprovedLeaveRequests } from '../../services/leave-request-service';
import { getAllHolidays } from '../../services/holiday-service';
import { getAllUsersForDisplay } from '../../services/user-service';
import { getTodaysAttendanceForAllUsers } from '../../services/attendance-service';
import { getAppSettings } from '../../services/settings-service';
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
    originalData: Project | LeaveRequest | HolidayEntry;
}

// Helper function to determine bar color based on progress
const getProgressColor = (progress: number, status: string): string => {
    if (status === 'Canceled') {
      return 'hsl(240 4.8% 95.9%)'; // Muted
    }
    if (progress === 100) {
      return 'hsl(142.1 76.2% 36.3%)'; // Green
    }
    if (progress >= 70) {
      return 'hsl(221.2 83.2% 53.3%)'; // Primary (Blue)
    }
    if (progress >= 30) {
      return 'hsl(35.6 91.6% 56.5%)'; // Orange
    }
    return 'hsl(0 84.2% 60.2%)'; // Destructive (Red)
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
            <Card><CardHeader><Skeleton className="h-6 w-1/3 mb-2" /><Skeleton className="h-4 w-1/2" /></CardHeader><CardContent><Skeleton className="h-32 w-full" /></CardContent></Card>
          </div>
          <div className="lg:col-span-1 space-y-6">
            <Card><CardHeader><Skeleton className="h-6 w-1/2 mb-2" /><Skeleton className="h-4 w-full" /></CardHeader><CardContent><Skeleton className="h-80 w-full" /></CardContent></Card>
          </div>
        </div>
      </div>
    );
}

export function DashboardPageClient({ initialData: unusedInitialData }: { initialData: any }) {
  const { currentUser } = useAuth();
  const { language } = useLanguage();
  const [data, setData] = useState<Awaited<ReturnType<typeof getDashboardData>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const dashboardDict = useMemo(() => getDictionary(language).dashboardPage, [language]);
  const projectsDict = useMemo(() => getDictionary(language).projectsPage, [language]);
  const currentLocale = useMemo(() => language === 'id' ? idLocale : enLocale, [language]);
  
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const fetchedData = await getDashboardData();
      setData(fetchedData);
      setIsLoading(false);
    }
    loadData();
  }, []);

  const { projects = [], leaveRequests = [], holidays = [], allUsers = [], todaysAttendance = [], attendanceEnabled = false } = data || {};

  const { eventsByDate, upcomingEvents } = useMemo(() => {
    const eventMap: Record<string, UnifiedEvent[]> = {};
    const upcoming: UnifiedEvent[] = [];
    const today = startOfToday();
    const threeDaysFromNow = addDays(today, 3);

    projects.forEach(p => {
      if (p.scheduleDetails?.date && p.scheduleDetails?.time) {
        const eventDate = parseISO(`${p.scheduleDetails.date}T${p.scheduleDetails.time}`);
        const key = format(eventDate, 'yyyy-MM-dd');
        if (!eventMap[key]) eventMap[key] = [];
        eventMap[key].push({ id: `sidang-${p.id}`, type: 'sidang', date: eventDate, title: p.title, time: p.scheduleDetails.time, location: p.scheduleDetails.location, originalData: p });
      }
      if (p.surveyDetails?.date && p.surveyDetails?.time) {
        const eventDate = parseISO(`${p.surveyDetails.date}T${p.surveyDetails.time}`);
        const key = format(eventDate, 'yyyy-MM-dd');
        if (!eventMap[key]) eventMap[key] = [];
        eventMap[key].push({ id: `survey-${p.id}`, type: 'survey', date: eventDate, title: p.title, time: p.surveyDetails.time, description: p.surveyDetails.description, originalData: p });
      }
    });

    leaveRequests.forEach(l => {
      const start = parseISO(l.startDate);
      const end = parseISO(l.endDate);
      for (let day = start; day <= end; day = addDays(day, 1)) {
        const key = format(day, 'yyyy-MM-dd');
        if (!eventMap[key]) eventMap[key] = [];
        eventMap[key].push({ id: `leave-${l.id}-${key}`, type: 'leave', date: day, title: l.displayName || l.username, description: l.reason, originalData: l });
      }
    });

    holidays.forEach(h => {
        const eventDate = parseISO(h.date);
        const key = format(eventDate, 'yyyy-MM-dd');
        if (!eventMap[key]) eventMap[key] = [];
        eventMap[key].push({ id: `holiday-${h.id}`, type: 'holiday', date: eventDate, title: h.name, description: h.description, originalData: h });
    });

    Object.keys(eventMap).forEach(key => {
      eventMap[key].sort((a, b) => {
        if (a.time && b.time) return a.time.localeCompare(b.time);
        if (a.time) return -1;
        if (b.time) return 1;
        return a.type.localeCompare(b.type);
      });
      const date = parseISO(key);
      if (isWithinInterval(date, { start: today, end: threeDaysFromNow })) {
          upcoming.push(...eventMap[key].filter(e => e.type === 'sidang' || e.type === 'survey'));
      }
    });

    upcoming.sort((a,b) => a.date.getTime() - b.date.getTime());

    return { eventsByDate: eventMap, upcomingEvents: upcoming };
  }, [projects, leaveRequests, holidays]);

  const attendanceSummary = useMemo(() => {
    const today = new Date();
    const todayHoliday = holidays.find(h => isSameDay(parseISO(h.date), today));

    if (todayHoliday) {
      return { isHoliday: true, holidayName: todayHoliday.name, checkedIn: 0, onLeave: 0, notCheckedIn: 0 };
    }

    const onLeaveToday = new Set<string>();
    leaveRequests.forEach(l => {
      if (isWithinInterval(today, { start: parseISO(l.startDate), end: endOfDay(parseISO(l.endDate)) })) {
        onLeaveToday.add(l.userId);
      }
    });

    const checkedInCount = todaysAttendance.length;
    const activeUsersToday = allUsers.filter(u => !onLeaveToday.has(u.id));
    const notCheckedInCount = activeUsersToday.filter(u => !todaysAttendance.some(a => a.userId === u.id)).length;

    return {
      isHoliday: false,
      holidayName: null,
      checkedIn: checkedInCount,
      onLeave: onLeaveToday.size,
      notCheckedIn: notCheckedInCount,
    };
  }, [allUsers, todaysAttendance, leaveRequests, holidays]);

  const activeProjects = useMemo(() => {
    return projects.filter(p => p.status !== 'Completed' && p.status !== 'Canceled');
  }, [projects]);
  
  const getTranslatedStatus = useCallback((statusKey: string): string => {
    const key = statusKey?.toLowerCase().replace(/ /g,'') as keyof typeof dashboardDict.status;
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

  const chartConfig = {
    progress: {
      label: dashboardDict.progressChart.label,
    },
  } satisfies ChartConfig;

  const canAddProject = useMemo(() => {
    if (!currentUser || !Array.isArray(currentUser.roles)) {
        return false;
    }
    const allowedRoles = ['Owner', 'Admin Proyek', 'Admin Developer'];
    return currentUser.roles.some(userRole => allowedRoles.includes(userRole));
  }, [currentUser]);
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  if (isLoading || !data) {
    return <DashboardSkeleton />;
  }

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <div className="container mx-auto py-4 px-4 md:px-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-primary">
            {dashboardDict.title}
          </h1>
          {canAddProject && (
              <Link href="/dashboard/add-project" passHref>
                  <Button className="w-full sm:w-auto accent-teal">
                      <PlusCircle className="mr-2 h-5 w-5" />
                      {dashboardDict.addNewProject}
                  </Button>
              </Link>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {(attendanceEnabled || (currentUser && currentUser.roles.includes('Admin Developer'))) && (
                <Card>
                    <CardHeader>
                        <CardTitle>{dashboardDict.attendanceSummary.title}</CardTitle>
                        <CardDescription>{format(new Date(), 'eeee, dd MMMM yyyy', { locale: currentLocale })}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {attendanceSummary.isHoliday ? (
                            <div className="flex items-center gap-3 text-muted-foreground p-4 bg-secondary rounded-lg">
                                <PartyPopper className="h-8 w-8 text-fuchsia-500"/>
                                <div>
                                    <p className="font-semibold text-foreground">{dashboardDict.attendanceSummary.holiday}</p>
                                    <p className="text-sm">{attendanceSummary.holidayName}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="flex items-center gap-3">
                                    <UserCheck className="h-7 w-7 text-green-500" />
                                    <div>
                                        <p className="text-lg font-bold">{attendanceSummary.checkedIn}</p>
                                        <p className="text-xs text-muted-foreground">{dashboardDict.attendanceSummary.present}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Plane className="h-7 w-7 text-blue-500" />
                                    <div>
                                        <p className="text-lg font-bold">{attendanceSummary.onLeave}</p>
                                        <p className="text-xs text-muted-foreground">{dashboardDict.attendanceSummary.onLeave}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <UserX className="h-7 w-7 text-red-500" />
                                    <div>
                                        <p className="text-lg font-bold">{attendanceSummary.notCheckedIn}</p>
                                        <p className="text-xs text-muted-foreground">{dashboardDict.attendanceSummary.absent}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>{dashboardDict.activeProjects}</CardTitle>
                    <CardDescription>{dashboardDict.allProjectsDesc}</CardDescription>
                </CardHeader>
                <CardContent>
                    {activeProjects.length === 0 ? (
                        <p className="text-muted-foreground">{dashboardDict.noProjects}</p>
                    ) : (
                        <div className="space-y-4">
                            {activeProjects.slice(0, 4).map(project => (
                                <Link href={`/dashboard/projects?projectId=${project.id}`} key={project.id} passHref>
                                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                                    <CardContent className="p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="flex-1 overflow-hidden w-full min-w-0">
                                            <p className="font-semibold truncate">{project.title}</p>
                                            <p className="text-xs text-muted-foreground truncate">{projectsDict.nextActionLabel}: {project.nextAction || projectsDict.none}</p>
                                        </div>
                                        <div className="flex-shrink-0 flex items-center gap-2 w-full sm:w-auto">
                                            <Badge variant="outline" className="flex-shrink-0">{getTranslatedStatus(project.assignedDivision)}</Badge>
                                            <Progress value={project.progress} className="w-full sm:w-20 h-2" />
                                        </div>
                                    </CardContent>
                                </Card>
                                </Link>
                            ))}
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <Link href="/dashboard/projects" passHref className="w-full">
                        <Button variant="outline" className="w-full">{`View All ${activeProjects.length} Active Projects`}</Button>
                    </Link>
                </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{dashboardDict.projectProgressChartTitle}</CardTitle>
                <CardDescription>{dashboardDict.projectProgressChartDesc}</CardDescription>
              </CardHeader>
              <CardContent className="pl-0 pr-4 sm:pl-2">
                {activeProjects.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <ResponsiveContainer>
                      <BarChart data={activeProjects} layout="vertical" margin={{ right: 40, left: 10 }}>
                        <XAxis type="number" dataKey="progress" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="title" tick={{ fontSize: 10, width: 80, textAnchor: 'end' }} interval={0} tickFormatter={(value) => value.length > 15 ? `${value.substring(0, 15)}...` : value} />
                        <ChartTooltip
                            cursor={{ fill: 'hsl(var(--muted))' }}
                            content={<ChartTooltipContent />}
                        />
                        <Bar dataKey="progress" radius={[0, 4, 4, 0]}>
                           <LabelList dataKey="progress" position="right" offset={8} className="fill-foreground" fontSize={12} formatter={(value: number) => `${value}%`} />
                           {activeProjects.map((project, index) => (
                                <Cell key={`cell-${index}`} fill={getProgressColor(project.progress, project.status)} />
                           ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <p className="text-sm text-muted-foreground">{dashboardDict.noProjectsForChart}</p>
                )}
              </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{dashboardDict.upcomingAgendaTitle}</CardTitle>
                    <CardDescription>{dashboardDict.upcomingAgendaDesc}</CardDescription>
                </CardHeader>
                <CardContent>
                    {upcomingEvents.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{dashboardDict.noUpcomingAgenda}</p>
                    ) : (
                        <ul className="space-y-3">
                            {upcomingEvents.slice(0, 5).map(event => (
                                <li key={event.id} className="flex items-start gap-3">
                                    <div className="flex-shrink-0 mt-1">{getEventTypeIcon(event.type)}</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{event.title}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {format(event.date, 'eeee, MMM d', { locale: currentLocale })}
                                            {event.time ? ` @ ${event.time}` : ''}
                                        </p>
                                        {event.type === 'survey' && event.description && (
                                            <p className="text-xs text-muted-foreground truncate">{dashboardDict.surveyDescriptionLabel} {event.description}</p>
                                        )}
                                        {event.type === 'sidang' && event.location && (
                                            <p className="text-xs text-muted-foreground truncate">{dashboardDict.eventLocationLabel} {event.location}</p>
                                        )}
                                    </div>
                                    <Badge variant="secondary" className="capitalize flex-shrink-0">{dashboardDict.eventTypes[event.type]}</Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card>
                <CardHeader>
                    <CardTitle>{dashboardDict.scheduleAgendaTitle}</CardTitle>
                    <CardDescription>{dashboardDict.scheduleAgendaDesc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-center">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            className="rounded-md border"
                            locale={currentLocale}
                            modifiers={{
                                hasEvent: Object.keys(eventsByDate).map(d => parseISO(d)),
                            }}
                            modifiersClassNames={{
                                hasEvent: "relative !bg-primary/10",
                            }}
                        />
                    </div>
                    <div className="space-y-3 pt-4 border-t h-48 overflow-y-auto pr-2">
                        <h3 className="text-md font-semibold">
                            {selectedDate ? `${dashboardDict.scheduleDetailsTitle} ${format(selectedDate, 'PPPP', { locale: currentLocale })}` : dashboardDict.selectDatePrompt}
                        </h3>
                        {selectedDate && eventsByDate[format(selectedDate, 'yyyy-MM-dd')] ? (
                            eventsByDate[format(selectedDate, 'yyyy-MM-dd')].map(event => (
                                <div key={event.id} className="flex gap-3">
                                    <div className="flex-shrink-0 mt-1">{getEventTypeIcon(event.type)}</div>
                                    <div>
                                        <p className="text-sm font-medium leading-tight">{event.title}</p>
                                        <p className="text-xs text-muted-foreground">{dashboardDict.eventTypes[event.type]}</p>
                                        {event.time && <p className="text-xs text-muted-foreground">{dashboardDict.eventTimeLabel} {event.time}</p>}
                                        {event.location && <p className="text-xs text-muted-foreground">{dashboardDict.eventLocationLabel} {event.location}</p>}
                                        {event.type === 'survey' && event.description && (
                                            <p className="text-xs text-muted-foreground">{dashboardDict.surveyDescriptionLabel} {event.description}</p>
                                        )}
                                        {event.type === 'leave' && event.description && (
                                            <p className="text-xs text-muted-foreground">{dashboardDict.reasonLabel}: {event.description}</p>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground">{dashboardDict.noEventsOnDate}</p>
                        )}
                    </div>
                </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Suspense>
  );
}
