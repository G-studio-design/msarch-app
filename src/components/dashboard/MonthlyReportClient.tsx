// src/components/dashboard/MonthlyReportClient.tsx
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, PieChart as PieChartIcon, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { getDictionary } from '@/lib/translations';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { type Project } from '../../services/project-service';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, getMonth, getYear } from 'date-fns';
import { id as idLocale, enUS as enLocale } from 'date-fns/locale';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, Cell } from "recharts";
import type { Language } from '@/context/LanguageContext';
import { toPng } from 'html-to-image';
import { cn } from '@/lib/utils';
import { Card as ResponsiveCard } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';


interface MonthlyReportData {
  completed: Project[];
  inProgress: Project[];
  canceled: Project[];
  monthName: string;
  year: string;
}

interface MonthlyReportClientProps {
    initialProjects: Project[];
}

const defaultDict = getDictionary('en');

const CHART_EXPORT_COLORS = {
  inProgress: "#2980B9", // Blue
  completed: "#27AE60", // Green
  canceled: "#C0392B", // Red
};


export default function MonthlyReportClient({ initialProjects }: MonthlyReportClientProps) {
  const { currentUser } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();

  const [dict, setDict] = React.useState(defaultDict);
  const [reportDict, setReportDict] = React.useState(defaultDict.monthlyReportPage);
  const [dashboardDict, setDashboardDict] = React.useState(defaultDict.dashboardPage);

  const currentMonth = (new Date().getMonth() + 1).toString();
  const currentYear = new Date().getFullYear().toString();

  const [selectedMonth, setSelectedMonth] = React.useState<string>(currentMonth);
  const [selectedYear, setSelectedYear] = React.useState<string>(currentYear);
  
  const [reportData, setReportData] = React.useState<MonthlyReportData | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState<false | 'word'>(false);
  const chartContainerRef = React.useRef<HTMLDivElement>(null);
  const [chartImageDataUrl, setChartImageDataUrl] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    const newDict = getDictionary(language);
    setDict(newDict);
    setReportDict(newDict.monthlyReportPage);
    setDashboardDict(newDict.dashboardPage);
  }, [language]);


  const canViewPage = currentUser && currentUser.roles && ['Owner', 'Akuntan', 'Admin Proyek', 'Admin Developer'].some(role => currentUser.roles.includes(role));

  const getMonthName = React.useCallback((monthNumber: number, lang: Language) => {
    const date = new Date();
    date.setMonth(monthNumber - 1);
    const locale = lang === 'id' ? idLocale : enLocale;
    return format(date, 'MMMM', { locale });
  }, []);
  
  const formatDateOnly = React.useCallback((timestamp: string | undefined | null): string => {
    if (!timestamp) return "N/A";
    try {
        const locale = language === 'id' ? idLocale : enLocale;
        return format(parseISO(timestamp), 'PP', { locale });
    } catch (e) {
        console.error("Error formatting date:", timestamp, e);
        return "Invalid Date";
    }
  }, [language]);

  const getLastActivityDate = React.useCallback((project: Project): string => {
    if (!project.workflowHistory || project.workflowHistory.length === 0) {
        return formatDateOnly(project.createdAt);
    }
    const lastEntry = project.workflowHistory[project.workflowHistory.length - 1];
    return formatDateOnly(lastEntry?.timestamp);
  }, [formatDateOnly]);

  const getContributors = React.useCallback((project: Project): string => {
    if (!project.files || project.files.length === 0) {
        return reportDict.none;
    }
    const contributors = [...new Set(project.files.map(f => f.uploadedBy || 'Unknown'))];
    return contributors.join(', ');
  }, [reportDict.none]);


  const handleGenerateReport = React.useCallback(async () => {
    if (!selectedMonth || !selectedYear) {
      toast({ variant: 'destructive', title: reportDict.toast.error, description: "Please select month and year."});
      return;
    }
    setIsGeneratingReport(true);
    setReportData(null);
    setChartImageDataUrl(null); 

    const monthInt = parseInt(selectedMonth, 10);
    const yearInt = parseInt(selectedYear, 10);

    const filteredProjects = initialProjects.filter(project => {
        try {
            let relevantDate: Date | null = null;
            if (project.status === 'Completed' || project.status === 'Canceled') {
                if (project.workflowHistory && project.workflowHistory.length > 0) {
                    const lastEntry = project.workflowHistory[project.workflowHistory.length - 1];
                    if (lastEntry) relevantDate = parseISO(lastEntry.timestamp);
                } else {
                     relevantDate = parseISO(project.createdAt); 
                }
            } else { 
                 relevantDate = parseISO(project.createdAt); 
            }

            if (!relevantDate) return false;
            
            const projectMatchesMonthYear = getYear(relevantDate) === yearInt && (getMonth(relevantDate) + 1) === monthInt;

             if (project.status !== 'Completed' && project.status !== 'Canceled') {
                const createdBeforeOrDuringMonth = getYear(parseISO(project.createdAt)) < yearInt || (getYear(parseISO(project.createdAt)) === yearInt && (getMonth(parseISO(project.createdAt)) + 1) <= monthInt);
                return createdBeforeOrDuringMonth; 
            }
            
            return projectMatchesMonthYear;

        } catch (e) {
            console.error("Error parsing date for project filtering:", project.id, e);
            return false;
        }
    });
    
    const completed = filteredProjects.filter(p => p.status === 'Completed' && getYear(parseISO(p.workflowHistory[p.workflowHistory.length -1]?.timestamp || p.createdAt)) === yearInt && (getMonth(parseISO(p.workflowHistory[p.workflowHistory.length -1]?.timestamp || p.createdAt)) + 1) === monthInt);
    const canceled = filteredProjects.filter(p => p.status === 'Canceled' && getYear(parseISO(p.workflowHistory[p.workflowHistory.length -1]?.timestamp || p.createdAt)) === yearInt && (getMonth(parseISO(p.workflowHistory[p.workflowHistory.length -1]?.timestamp || p.createdAt)) + 1) === monthInt);
    const inProgress = initialProjects.filter(p => {
        const createdDate = parseISO(p.createdAt);
        const createdBeforeOrDuringSelectedMonth = getYear(createdDate) < yearInt || (getYear(createdDate) === yearInt && (getMonth(createdDate) + 1) <= monthInt);
        
        if (!createdBeforeOrDuringSelectedMonth) return false;

        if (p.status === 'Completed' || p.status === 'Canceled') {
             const endDateISO = p.workflowHistory[p.workflowHistory.length-1]?.timestamp || p.createdAt;
             if (!endDateISO) return true;
             const endDate = parseISO(endDateISO);
             return getYear(endDate) > yearInt || (getYear(endDate) === yearInt && (getMonth(endDate) + 1) > monthInt);
        }
        return true; 
    });


    const currentMonthName = getMonthName(monthInt, language);
    const newReportData = { completed, inProgress, canceled, monthName: currentMonthName, year: selectedYear };
    setReportData(newReportData);
    
    if (newReportData.completed.length === 0 && newReportData.inProgress.length === 0 && newReportData.canceled.length === 0) {
      toast({ title: reportDict.noDataForMonth, description: reportDict.tryDifferentMonthYear });
    }
    setIsGeneratingReport(false); 
  }, [selectedMonth, selectedYear, initialProjects, toast, reportDict, language, getMonthName]);


  React.useEffect(() => {
    const generateChartImage = async () => {
        if (reportData && chartContainerRef.current && (reportData.inProgress.length > 0 || reportData.completed.length > 0 || reportData.canceled.length > 0)) {
            try {
                const dataUrl = await toPng(chartContainerRef.current, {
                    skipFonts: true, 
                    backgroundColor: '#FFFFFF' 
                });
                setChartImageDataUrl(dataUrl);
            } catch (error) {
                console.error('Failed to generate chart image:', error);
                toast({ variant: 'destructive', title: reportDict.toast.chartImageErrorTitle, description: reportDict.toast.chartImageErrorDesc });
                setChartImageDataUrl(null);
            }
        } else if (reportData) { 
            setChartImageDataUrl(null);
        }
    };
    if (reportData) { 
        const timer = setTimeout(generateChartImage, 500);
        return () => clearTimeout(timer);
    }
  }, [reportData, toast, reportDict.toast.chartImageErrorTitle, reportDict.toast.chartImageErrorDesc]);


  const handleDownloadWord = async () => {
    if (!reportData) {
        toast({ variant: 'destructive', title: reportDict.toast.error, description: reportDict.toast.generateReportFirst });
        return;
    }
    setIsDownloading('word');
    try {
        const payload = {
            reportData,
            monthName: reportData.monthName,
            year: reportData.year,
            language,
            chartImageDataUrl, 
        };
        const response = await fetch('/api/generate-report/word', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            let errorDetails = `Server returned status ${response.status}.`;
            let responseText = "";
            try {
                responseText = await response.text();
                if (responseText.trim().startsWith('{') && responseText.trim().endsWith('}')) {
                    const errorData = JSON.parse(responseText);
                    console.error("[Client/WordDownload] Raw errorData from server:", JSON.stringify(errorData)); 
                    if (typeof errorData === 'object' && errorData !== null && Object.keys(errorData).length === 0) {
                        errorDetails = "The server returned an empty error response. Please check server logs for more details.";
                    } else {
                        errorDetails = errorData.details || errorData.error || errorDetails;
                    }
                } else {
                     errorDetails = responseText.length > 500 ? responseText.substring(0,500) + "..." : responseText; 
                     if (responseText.toLowerCase().includes('<html')) { 
                         errorDetails = `Server returned an HTML error page (status ${response.status}). Check server logs.`;
                     }
                }
            } catch (jsonError) {
                console.error("Error parsing JSON error response or reading text from server for Word generation:", jsonError, "Raw response text (if available):", responseText);
                errorDetails = `Server returned status ${response.status}. Original error: ${String(responseText || '').substring(0,200)}`;
            }
             let userFriendlyError = "The Word document could not be generated due to an internal error.";
            if(errorDetails && errorDetails.toLowerCase().includes("cannot read properties of undefined (reading 'children')")) {
                userFriendlyError = "The Word document could not be generated due to an internal structure error, possibly related to empty content sections. Please contact support or try again later.";
            } else if (errorDetails.includes("Failed to generate Word document")) {
                 userFriendlyError = "The Word document could not be generated. Please contact support.";
            }
            
            throw new Error(String(userFriendlyError + " Details: " + errorDetails || "An unknown error occurred detailing the server response."));
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `monthly_report_${reportData.year}_${reportData.monthName.replace(/ /g, '_')}_${language}.docx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        toast({ title: reportDict.toast.downloadSuccessTitle, description: reportDict.toast.downloadSuccessDescWord });
    } catch (error: any) {
        console.error('Error downloading Word report:', error);
        toast({ variant: 'destructive', title: reportDict.toast.error, description: String(error.message || reportDict.toast.downloadErrorDesc) });
    } finally {
        setIsDownloading(false);
    }
  };


  const years = Array.from({ length: 10 }, (_, i) => (parseInt(currentYear) - 5 + i).toString());
  const months = Array.from({ length: 12 }, (_, i) => ({ value: (i + 1).toString(), label: getMonthName(i + 1, language) }));

  const chartConfig = React.useMemo(() => ({
    count: { label: reportDict.totalProjectsShort, color: "hsl(var(--foreground))" },
    [reportDict.status.inprogress]: { label: reportDict.status.inprogress, color: CHART_EXPORT_COLORS.inProgress },
    [reportDict.status.completed]: { label: reportDict.status.completed, color: CHART_EXPORT_COLORS.completed },
    [reportDict.status.canceled]: { label: reportDict.status.canceled, color: CHART_EXPORT_COLORS.canceled },
  } satisfies ChartConfig), [reportDict]);


  const chartDisplayData = React.useMemo(() => {
    if (!reportData) return [];
    return [
      { name: reportDict.status.inprogress, count: reportData.inProgress.length, fill: chartConfig[reportDict.status.inprogress].color },
      { name: reportDict.status.completed, count: reportData.completed.length, fill: chartConfig[reportDict.status.completed].color },
      { name: reportDict.status.canceled, count: reportData.canceled.length, fill: chartConfig[reportDict.status.canceled].color },
    ].filter(item => item.count > 0); 
  }, [reportData, reportDict.status, chartConfig]);

  const allProjectsForReport = React.useMemo(() => {
    if (!reportData) return [];
    const combined = [...reportData.inProgress, ...reportData.completed, ...reportData.canceled];
    combined.sort((a, b) => {
        const statusOrderValue = (project: Project) => {
            const statusKey = project.status.toLowerCase().replace(/ /g, '') as keyof typeof dashboardDict.status;
            const translatedStatus = dashboardDict.status[statusKey] || project.status;
            if (translatedStatus === dashboardDict.status.inprogress) return 0;
            if (translatedStatus === dashboardDict.status.completed) return 1;
            if (translatedStatus === dashboardDict.status.canceled) return 2;
            return 3;
        };
        const orderA = statusOrderValue(a);
        const orderB = statusOrderValue(b);
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return combined;
  }, [reportData, dashboardDict.status]);


  if (!canViewPage) {
    return (
      <div className="container mx-auto py-4 px-4 md:px-6">
        <Card className="border-destructive">
          <CardHeader><CardTitle className="text-destructive">{dict.manageUsersPage.accessDeniedTitle}</CardTitle></CardHeader>
          <CardContent><p>{dict.manageUsersPage.accessDeniedDesc}</p></CardContent>
        </Card>
      </div>
    );
  }
  
  const noDataForReport = reportData && reportData.completed.length === 0 && reportData.inProgress.length === 0 && reportData.canceled.length === 0;
  const noDataForChart = !chartDisplayData || chartDisplayData.length === 0;


  return (
    <div className="container mx-auto py-4 px-4 md:px-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl">{reportDict.title}</CardTitle>
          <CardDescription>{reportDict.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="month-select">{reportDict.selectMonthLabel}</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger id="month-select" aria-label={reportDict.selectMonthPlaceholder}><SelectValue placeholder={reportDict.selectMonthPlaceholder} /></SelectTrigger>
                <SelectContent>
                  {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="year-select">{reportDict.selectYearLabel}</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger id="year-select" aria-label={reportDict.selectYearPlaceholder}><SelectValue placeholder={reportDict.selectYearPlaceholder} /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerateReport} disabled={isGeneratingReport} className="w-full sm:w-auto md:self-end accent-teal">
              {isGeneratingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isGeneratingReport ? reportDict.generatingReportButton : reportDict.generateReportButton}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isGeneratingReport && !reportData && (
          <div className="flex flex-col items-center justify-center text-center py-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg text-muted-foreground">{reportDict.generatingReportButton}</p>
          </div>
      )}

      {reportData && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">{reportDict.reportFor} {reportData.monthName} {reportData.year}</CardTitle>
              <CardDescription>
                {reportDict.totalProjectsDesc
                    .replace('{total}', (reportData.completed.length + reportData.inProgress.length + reportData.canceled.length).toString())
                    .replace('{completed}', reportData.completed.length.toString())
                    .replace('{canceled}', reportData.canceled.length.toString())
                    .replace('{inProgress}', reportData.inProgress.length.toString())
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="w-full overflow-x-auto rounded-md border mb-6">
                    <div ref={chartContainerRef} className="bg-background p-2 sm:p-4 min-w-[500px]">
                        {noDataForChart ? (
                            <div className="flex flex-col items-center justify-center h-[250px] sm:h-[300px] text-center text-muted-foreground p-4">
                                <PieChartIcon className="h-12 w-12 mb-2 opacity-50" />
                                <p>{reportDict.noDataForMonth}</p>
                            </div>
                        ) : (
                            <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px]">
                                <ResponsiveContainer>
                                    <BarChart
                                        data={chartDisplayData}
                                        layout="vertical"
                                        margin={{ left: language === 'id' ? 25 : 20, right: 35, top: 5, bottom: 5 }}
                                    >
                                        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                                        <XAxis type="number" dataKey="count" allowDecimals={false} tick={{ fontSize: 10 }} />
                                        <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} stroke="#888888" fontSize={10} width={language === 'id' ? 105 : 75} interval={0}/>
                                        <ChartTooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent hideLabel />} />
                                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                            <LabelList dataKey="count" position="right" offset={8} className="fill-foreground" fontSize={10} />
                                            {chartDisplayData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        )}
                    </div>
                </div>

              {!noDataForReport && (
                <>
                  <div className="hidden md:block">
                    <ScrollArea className="w-full rounded-md border">
                      <Table className="min-w-[1000px]">
                        <TableCaption>{reportDict.tableCaption}</TableCaption>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{reportDict.tableHeaderTitle}</TableHead>
                            <TableHead>{reportDict.tableHeaderStatus}</TableHead>
                            <TableHead>{reportDict.tableHeaderLastActivityDate}</TableHead>
                            <TableHead>{reportDict.tableHeaderContributors}</TableHead>
                            <TableHead className="text-right">{reportDict.tableHeaderProgress}</TableHead>
                            <TableHead>{reportDict.tableHeaderCreatedBy}</TableHead>
                            <TableHead>{reportDict.tableHeaderCreatedAt}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allProjectsForReport.map((project) => (
                            <TableRow key={`desktop-${project.id}`}>
                              <TableCell className="font-medium">{project.title}</TableCell>
                              <TableCell>
                                <Badge variant={ project.status === 'Completed' ? 'default' : project.status === 'Canceled' ? 'destructive' : 'secondary'}
                                  className={cn(project.status === 'Completed' && 'bg-green-500 hover:bg-green-600 text-white')}>
                                  {dashboardDict.status[project.status.toLowerCase().replace(/ /g, '') as keyof typeof dashboardDict.status] || project.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{getLastActivityDate(project)}</TableCell>
                              <TableCell className="break-words">{getContributors(project)}</TableCell>
                              <TableCell className="text-right">{project.progress}%</TableCell>
                              <TableCell>{project.createdBy}</TableCell>
                              <TableCell>{formatDateOnly(project.createdAt)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                  
                  <div className="grid gap-4 md:hidden">
                    {allProjectsForReport.map((project) => (
                      <ResponsiveCard key={`mobile-${project.id}`}>
                        <CardHeader>
                            <CardTitle className="text-base break-words truncate">{project.title}</CardTitle>
                            <CardDescription>
                                <Badge variant={ project.status === 'Completed' ? 'default' : project.status === 'Canceled' ? 'destructive' : 'secondary'} className={cn(project.status === 'Completed' && 'bg-green-500 hover:bg-green-600 text-white')}>
                                {dashboardDict.status[project.status.toLowerCase().replace(/ /g, '') as keyof typeof dashboardDict.status] || project.status}
                                </Badge>
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                           <div><span className="font-semibold">{reportDict.tableHeaderProgress}:</span> {project.progress}%</div>
                           <div><span className="font-semibold">{reportDict.tableHeaderLastActivityDate}:</span> {getLastActivityDate(project)}</div>
                           <div className="break-words"><span className="font-semibold">{reportDict.tableHeaderContributors}:</span> {getContributors(project)}</div>
                           <div className="break-words"><span className="font-semibold">{reportDict.tableHeaderCreatedBy}:</span> {project.createdBy}</div>
                           <div><span className="font-semibold">{reportDict.tableHeaderCreatedAt}:</span> {formatDateOnly(project.createdAt)}</div>
                        </CardContent>
                      </ResponsiveCard>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
       {reportData && noDataForReport && !isGeneratingReport && (
         <Card>
            <CardContent className="py-10 text-center">
                <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">{reportDict.noDataForMonth}</p>
                <p className="text-sm text-muted-foreground">{reportDict.tryDifferentMonthYear}</p>
            </CardContent>
         </Card>
       )}

      {reportData && !noDataForReport && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{reportDict.downloadReportSectionTitle}</CardTitle>
            <CardDescription>{reportDict.downloadReportSectionDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleDownloadWord} disabled={isDownloading === 'word' || isGeneratingReport} className="w-full sm:w-auto">
              {isDownloading === 'word' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              {reportDict.downloadWord}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
