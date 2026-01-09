
// src/lib/attendance-report-generator.ts
'use server';

import {
  Document, Packer, Paragraph, TextRun, Table, TableCell, TableRow,
  WidthType, BorderStyle, VerticalAlign, AlignmentType, ShadingType, Header, Footer, PageNumber, SectionType
} from 'docx';
import type { AttendanceRecord } from '@/services/attendance-service';
import type { User } from '@/types/user-types';
import type { LeaveRequest } from '@/types/leave-request-types';
import type { HolidayEntry } from '@/services/holiday-service';
import type { Language } from '@/context/LanguageContext';
import { getDictionary } from '@/lib/translations';
import { format, parseISO, eachDayOfInterval, isWithinInterval } from 'date-fns';
import { id as IndonesianLocale, enUS as EnglishLocale } from 'date-fns/locale';

interface ReportData {
  records: AttendanceRecord[];
  users: Omit<User, 'password'>[];
  leaves: LeaveRequest[];
  holidays: HolidayEntry[];
  month: number;
  year: number;
  monthName: string;
  language: Language;
}

const ensureNonEmpty = (text: string | null | undefined, defaultText = '\u00A0'): string => {
  if (text === null || text === undefined) return defaultText;
  const trimmed = String(text).trim();
  return trimmed === '' ? defaultText : String(text);
};

const formatTimeOnly = (isoString?: string): string => {
  if (!isoString) return '--:--';
  try {
    return format(parseISO(isoString), 'HH:mm:ss');
  } catch (e) {
    return 'Invalid';
  }
};

export async function generateAttendanceWordReport(data: ReportData): Promise<Buffer> {
  const { records, users, leaves, holidays, month, year, monthName, language } = data;
  const dict = getDictionary(language).attendanceReportPage;
  const dictGlobal = getDictionary(language);
  const currentLocale = language === 'id' ? IndonesianLocale : EnglishLocale;

  const reportInterval = { start: new Date(year, month - 1, 1), end: new Date(year, month, 0) };

  const userStats: { [userId: string]: { present: number; late: number; on_leave: number } } = {};
  users.forEach(u => {
    userStats[u.id] = { present: 0, late: 0, on_leave: 0 };
  });

  records.forEach(r => {
    if (userStats[r.userId]) {
      if (r.status === 'Present') userStats[r.userId].present++;
      if (r.status === 'Late') userStats[r.userId].late++;
    }
  });

  const monthlyLeaves = leaves.filter(l => 
      isWithinInterval(parseISO(l.startDate), reportInterval) ||
      isWithinInterval(parseISO(l.endDate), reportInterval) ||
      (parseISO(l.startDate) < reportInterval.start && parseISO(l.endDate) > reportInterval.end)
  );

  monthlyLeaves.forEach(leave => {
      if (userStats[leave.userId]) {
          eachDayOfInterval({ start: parseISO(leave.startDate), end: parseISO(leave.endDate) })
          .forEach(day => { if (isWithinInterval(day, reportInterval)) { userStats[leave.userId].on_leave++; }});
      }
  });


  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: ensureNonEmpty(dict.reportTitle), size: 44, bold: true, color: "1A237E" })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
    children: [new TextRun({ text: ensureNonEmpty(`${dict.reportFor} ${monthName} ${year}`), size: 32, color: "2c3e50" })],
  }));

  // Summary Table
  const summaryRows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({ shading: { type: ShadingType.SOLID, color: "4A90E2", fill: "4A90E2" }, children: [new Paragraph({ children: [new TextRun({ text: dict.tableHeaderEmployee, bold: true, color: "FFFFFF", size: 24 })] })], verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ shading: { type: ShadingType.SOLID, color: "4A90E2", fill: "4A90E2" }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: dict.tableHeaderPresent, bold: true, color: "FFFFFF", size: 24 })] })], verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ shading: { type: ShadingType.SOLID, color: "4A90E2", fill: "4A90E2" }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: dict.tableHeaderLate, bold: true, color: "FFFFFF", size: 24 })] })], verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ shading: { type: ShadingType.SOLID, color: "4A90E2", fill: "4A90E2" }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: dict.tableHeaderOnLeave, bold: true, color: "FFFFFF", size: 24 })] })], verticalAlign: VerticalAlign.CENTER }),
      ]
    })
  ];

  users.forEach((user, index) => {
    const stats = userStats[user.id];
    const shading = index % 2 === 0 ? { type: ShadingType.SOLID, color: "F4F8FB", fill: "F4F8FB" } : undefined;
    summaryRows.push(new TableRow({
      children: [
        new TableCell({ shading, children: [new Paragraph({ text: ensureNonEmpty(user.displayName || user.username) })], verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ shading, children: [new Paragraph({ text: ensureNonEmpty(stats.present.toString()), alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ shading, children: [new Paragraph({ text: ensureNonEmpty(stats.late.toString()), alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ shading, children: [new Paragraph({ text: ensureNonEmpty(stats.on_leave.toString()), alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
      ]
    }));
  });

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: summaryRows,
    columnWidths: [55, 15, 15, 15]
  }));

  // Detailed Log
  children.push(new Paragraph({
    spacing: { before: 800, after: 200 },
    children: [new TextRun({ text: ensureNonEmpty(dict.detailedLogTitle), size: 36, bold: true, color: "1A237E" })],
  }));
  
  // Combined events for detailed log
  interface CombinedEvent { type: 'attendance' | 'leave'; date: string; user: Omit<User, 'password'>; data: AttendanceRecord | LeaveRequest; }
  const eventMap = new Map<string, CombinedEvent>();
  records.forEach(rec => {
    const user = users.find(u => u.id === rec.userId);
    if(user) eventMap.set(`${rec.userId}-${rec.date}`, { type: 'attendance', date: rec.date, user, data: rec });
  });
  monthlyLeaves.forEach(leave => {
    const user = users.find(u => u.id === leave.userId);
    if (user) {
        eachDayOfInterval({start: parseISO(leave.startDate), end: parseISO(leave.endDate)}).forEach(day => {
            if (isWithinInterval(day, reportInterval)) {
                const dateStr = format(day, 'yyyy-MM-dd');
                if (!eventMap.has(`${user.id}-${dateStr}`)) {
                    eventMap.set(`${user.id}-${dateStr}`, { type: 'leave', date: dateStr, user, data: leave });
                }
            }
        });
    }
  });
  const combinedEvents = Array.from(eventMap.values()).sort((a, b) => {
    const dateComparison = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateComparison !== 0) return dateComparison;
    const nameA = a.user.displayName || a.user.username;
    const nameB = b.user.displayName || b.user.username;
    return nameA.localeCompare(nameB);
  });

  const detailRows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({ shading: { type: ShadingType.SOLID, color: "4A90E2", fill: "4A90E2" }, children: [new Paragraph({ children: [new TextRun({ text: dict.detailHeaderDate, bold: true, color: "FFFFFF", size: 24 })] })], verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ shading: { type: ShadingType.SOLID, color: "4A90E2", fill: "4A90E2" }, children: [new Paragraph({ children: [new TextRun({ text: dict.detailHeaderEmployee, bold: true, color: "FFFFFF", size: 24 })] })], verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ shading: { type: ShadingType.SOLID, color: "4A90E2", fill: "4A90E2" }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: dict.detailHeaderCheckIn, bold: true, color: "FFFFFF", size: 24 })] })], verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ shading: { type: ShadingType.SOLID, color: "4A90E2", fill: "4A90E2" }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: dict.detailHeaderCheckOut, bold: true, color: "FFFFFF", size: 24 })] })], verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ shading: { type: ShadingType.SOLID, color: "4A90E2", fill: "4A90E2" }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: dict.detailHeaderStatus, bold: true, color: "FFFFFF", size: 24 })] })], verticalAlign: VerticalAlign.CENTER }),
      ]
    })
  ];

  combinedEvents.forEach((event, index) => {
    const shading = index % 2 === 0 ? { type: ShadingType.SOLID, color: "F4F8FB", fill: "F4F8FB" } : undefined;
    const formattedDate = format(parseISO(event.date), 'eeee, dd MMMM yyyy', { locale: currentLocale });
    let row: TableRow;
    
    if (event.type === 'attendance') {
        const attData = event.data as AttendanceRecord;
        row = new TableRow({ children: [
            new TableCell({ shading, children: [new Paragraph({ text: formattedDate })], verticalAlign: VerticalAlign.CENTER }),
            new TableCell({ shading, children: [new Paragraph({ text: ensureNonEmpty(attData.displayName) })], verticalAlign: VerticalAlign.CENTER }),
            new TableCell({ shading, children: [new Paragraph({ text: formatTimeOnly(attData.checkInTime), alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
            new TableCell({ shading, children: [new Paragraph({ text: formatTimeOnly(attData.checkOutTime), alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
            new TableCell({ shading, children: [new Paragraph({ text: ensureNonEmpty(dictGlobal.attendancePage.status[attData.status.toLowerCase() as keyof typeof dictGlobal.attendancePage.status] || attData.status), alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
        ]});
    } else { // 'leave'
        const leaveData = event.data as LeaveRequest;
        const leaveTypeText = dictGlobal.leaveRequestPage.leaveTypes[leaveData.leaveType.toLowerCase().replace(/ /g, '') as keyof typeof dictGlobal.leaveRequestPage.leaveTypes] || leaveData.leaveType;
        row = new TableRow({ children: [
            new TableCell({ shading, children: [new Paragraph({ text: formattedDate })], verticalAlign: VerticalAlign.CENTER }),
            new TableCell({ shading, children: [new Paragraph({ text: ensureNonEmpty(event.user.displayName || event.user.username) })], verticalAlign: VerticalAlign.CENTER }),
            new TableCell({ shading, children: [new Paragraph({ text: `IZIN: ${leaveTypeText}`, alignment: AlignmentType.CENTER, style: "italic" })], verticalAlign: VerticalAlign.CENTER, columnSpan: 3 }),
        ]});
    }
    detailRows.push(row);
  });
  
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: detailRows,
    columnWidths: [30, 30, 10, 10, 20]
  }));

  const doc = new Document({
    creator: "Msarch App",
    title: `${dict.reportTitle} - ${monthName} ${year}`,
    sections: [{
      properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Msarch App - Laporan Absensi Bulanan", italics: true, color: "7F8C8D" })] })] }) },
      footers: { default: new Footer({ children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
              new TextRun("Halaman "),
              new TextRun({ children: [PageNumber.CURRENT] }),
              new TextRun(" dari "),
              new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
          ]
        })
      ] }) },
      children: children,
    }]
  });

  return Packer.toBuffer(doc);
}
