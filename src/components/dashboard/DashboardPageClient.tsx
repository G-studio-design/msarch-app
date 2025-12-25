// src/components/dashboard/DashboardPageClient.tsx
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
import { useDictionary } from '@/context/LanguageContext';
import type { Project } from '@/types/project-types';
import type { LeaveRequest } from '@/types/leave-request-types';
import type { User } from '@/types/user-types';
import type { AttendanceRecord } from '@/services/attendance-service';
import Link from 'next/link';
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, startOfToday, isSameDay, addDays, isWithinInterval, endOfDay } from 'date-fns';
import { id as idLocale, enUS as enLocale } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';
import {
    ArrowRight,
    Briefcase,
    Building,
    CheckCircle,
    MapPin,
    PartyPopper,
    Plane,
    PlusCircle,
    UserCheck,
    UserX
} from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LabelList, Cell } from "recharts";
import { Skeleton } from '@/components/ui/skeleton';
import type { HolidayEntry } from '@/services/holiday-service';

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

interface DashboardData {
    projects: Project[];
    leaveRequests: LeaveRequest[];
    holidays: HolidayEntry[];
    allUsers: Omit<User, 'password'>[];
    todaysAttendance: AttendanceRecord[];
    attendanceEnabled: boolean;
}
