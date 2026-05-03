'use client';

/**
 * Version: 2.1.0 - Strict Checklist Matching
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Upload,
  CheckCircle,
  XCircle,
  FileText,
  Trash2,
  CalendarClock,
  Loader2,
  AlertTriangle,
  ListFilter,
  ArrowLeft,
  Download,
  Search,
  MapPin,
  Shield,
  Circle as CircleIcon,
  Wrench,
  Check,
  CalendarIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useLanguage } from '@/context/LanguageContext';
import { getDictionary } from '@/lib/translations';
import { useAuth } from '@/context/AuthContext';
import type { Project, WorkflowHistoryEntry, FileEntry, UpdateProjectParams } from '@/types/project-types';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { useSearchParams, useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { format, parseISO } from 'date-fns';
import { id as IndonesianLocale, enUS as EnglishLocale } from 'date-fns/locale';
import { API_BASE_URL } from '@/config/api-config';

const projectStatuses = [
    'Pending Offer', 'Pending Approval', 'Pending DP Invoice',
    'Pending Admin Files', 'Pending Survey Details', 'Survey Scheduled', 'Pending Architect Files', 'Pending Structure Files', 'Pending MEP Files',
    'Pending Scheduling', 'Scheduled', 'Pending Post-Sidang Revision', 'Pending Parallel Design Uploads',
    'In Progress', 'Completed', 'Canceled', 'Pending Consultation Docs', 'Pending Review', 'Pending Final Documents', 'Pending Pelunasan Invoice', 'Pending Sidang Registration Proof'
];

interface ChecklistItem {
    name: string;
    uploaded: boolean;
    files: FileEntry[];
}
interface ParallelUploadChecklist {
    [key: string]: ChecklistItem[] | undefined;
    Arsitek?: ChecklistItem[];
    Struktur?: ChecklistItem[];
    MEP?: ChecklistItem[];
}

interface GroupedHistoryItem {
    timestamp: string;
    entries: WorkflowHistoryEntry[];
    files: FileEntry[];
}

const finalDocRequirements = ['Dokumen Final', 'Berita Acara', 'SKRD', 'Bukti Pembayaran', 'Ijin Terbit', 'Pelunasan', 'Tanda Terima'];

/**
 * Strict Sanitization - MUST match server-side sanitizeForPath exactly.
 */
function safeSanitize(text: string): string {
    return text.toLowerCase()
        .trim()
        .replace(/[\s-]+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/_+/g, '_');
}

interface UploadDialogState {
  isOpen: boolean;
  item: { name: string } | null;
  division: string | null;
}

interface ProjectsPageClientProps {
    initialProjects: Project[];
}

export default function ProjectsPageClient({ initialProjects }: ProjectsPageClientProps) {
  const { toast } = useToast();
  const { language } = useLanguage();
  const { currentUser } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const dict = React.useMemo(() => getDictionary(language), [language]);
  const projectsDict = React.useMemo(() => dict.projectsPage, [dict]);
  const dashboardDict = React.useMemo(() => dict.dashboardPage, [dict]);

  const [allProjects, setAllProjects] = React.useState<Project[]>(initialProjects);
  const [isLoadingProjects, setIsLoadingProjects] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<Project | null>(null);

  const [description, setDescription] = React.useState('');
  const [uploadedFiles, setUploadedFiles] = React.useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const [scheduleDate, setScheduleDate] = React.useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = React.useState('');
  const [scheduleLocation, setScheduleLocation] = React.useState('');

  const [surveyDate, setSurveyDate] = React.useState<Date | undefined>();
  const [surveyTime, setSurveyTime] = React.useState('');
  const [surveyDescription, setSurveyDescription] = React.useState('');

  const [isDownloading, setIsDownloading] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string[]>([]);
  const [displayedProjects, setDisplayedProjects] = React.useState<Project[]>([]);
  
  const [parallelUploadChecklist, setParallelUploadChecklist] = React.useState<ParallelUploadChecklist | null>(null);

  const [isDeletingFile, setIsDeletingFile] = React.useState<string | null>(null);
  const [uploadDialogState, setUploadDialogState] = React.useState<UploadDialogState>({ isOpen: false, item: null, division: null });

  const [isClient, setIsClient] = React.useState(false);
  React.useEffect(() => { setIsClient(true); }, []);

  const projectIdFromUrl = searchParams.get('projectId');

  const getBaseName = (filePath: string) => {
    // Robust basename logic for browser
    return filePath.split(/[\\/]/).pop() || '';
  };

  const fetchAllProjects = React.useCallback(async () => {
    setIsLoadingProjects(true);
    try {
        const response = await fetch(`${API_BASE_URL}/api/projects`);
        if (!response.ok) throw new Error('Failed to fetch projects');
        const data = await response.json();
        setAllProjects(data);
    } catch (error) {
        console.error("Failed to fetch projects:", error);
        toast({ variant: 'destructive', title: projectsDict.toast.error, description: projectsDict.toast.couldNotLoadProjects });
    } finally {
        setIsLoadingProjects(false);
    }
  }, [toast, projectsDict]);

  React.useEffect(() => {
    const handleDataRefresh = () => fetchAllProjects();
    window.addEventListener('refresh-data', handleDataRefresh);
    return () => window.removeEventListener('refresh-data', handleDataRefresh);
  }, [fetchAllProjects]);

  const fetchProjectById = React.useCallback(async (id: string): Promise<Project | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${id}`);
      if (!response.ok) throw new Error(`Failed to fetch project ${id}`);
      return await response.json();
    } catch (error) {
      console.error(error);
      return null;
    }
  }, []);

  React.useEffect(() => {
    if (allProjects.length > 0) {
      if (projectIdFromUrl) {
        const projectToSelect = allProjects.find(p => p.id === projectIdFromUrl);
        if (projectToSelect) {
          setSelectedProject(projectToSelect);
          if (isClient) {
              setScheduleDate(projectToSelect.scheduleDetails?.date ? parseISO(projectToSelect.scheduleDetails.date) : undefined);
              setScheduleTime(projectToSelect.scheduleDetails?.time || '');
              setScheduleLocation(projectToSelect.scheduleDetails?.location || '');
              setSurveyDate(projectToSelect.surveyDetails?.date ? parseISO(projectToSelect.surveyDetails.date) : undefined);
              setSurveyTime(projectToSelect.surveyDetails?.time || '');
              setSurveyDescription(projectToSelect.surveyDetails?.description || '');
          }
        } else {
          toast({ variant: 'destructive', title: projectsDict.toast.error, description: projectsDict.toast.projectNotFound });
          router.replace('/dashboard/projects', { scroll: false });
        }
      } else {
        setSelectedProject(null);
      }
    }
  }, [projectIdFromUrl, allProjects, router, toast, projectsDict, isClient]);

    const getParallelChecklistStatus = React.useCallback((project: Project | null): ParallelUploadChecklist | null => {
        if (!project) return null;

        const isParallelOrRevision = ['Pending Parallel Design Uploads', 'Pending Post-Sidang Revision'].includes(project.status);
        if (!isParallelOrRevision) return null;

        const requiredChecklists: ParallelUploadChecklist = {
            Arsitek: [
                { name: 'Gambar', uploaded: false, files: [] },
                { name: 'Daftar Simak', uploaded: false, files: [] },
                { name: 'SpekTek', uploaded: false, files: [] },
                { name: 'RAP', uploaded: false, files: [] }
            ],
            Struktur: [
                { name: 'Gambar', uploaded: false, files: [] },
                { name: 'Analisa Laporan', uploaded: false, files: [] },
                { name: 'Hammer Test', uploaded: false, files: [] },
                { name: 'SpekTek', uploaded: false, files: [] },
                { name: 'Daftar Simak', uploaded: false, files: [] }
            ],
            MEP: [
                { name: 'Gambar', uploaded: false, files: [] },
                { name: 'Daftar Simak', uploaded: false, files: [] },
                { name: 'SpekTek', uploaded: false, files: [] },
                { name: 'RAP', uploaded: false, files: [] },
                { name: 'Laporan', uploaded: false, files: [] }
            ],
        };
        
        const currentStatus: ParallelUploadChecklist = {};
        const projectFiles = project.files || [];

        (Object.keys(requiredChecklists) as (keyof ParallelUploadChecklist)[]).forEach(division => {
            const checklistItems = requiredChecklists[division];
            if (checklistItems) {
                currentStatus[division] = checklistItems.map(item => {
                    // Strict prefix: e.g. "arsitek_gambar_"
                    const prefix = safeSanitize(division + "_" + item.name) + "_";
                    
                    const matchingFiles = projectFiles.filter(file => {
                        const fileNameOnDisk = getBaseName(file.path);
                        
                        // Rule 1: Matches the strict new prefix
                        const hasStrictPrefix = fileNameOnDisk.startsWith(prefix);
                        
                        // Rule 2: Fallback for older files or files uploaded before role verification
                        // We check if the division name is anywhere in the prefix part of the filename
                        const isUploadedByMatchingRole = file.uploadedBy === division;
                        const startsWithItemName = fileNameOnDisk.startsWith(safeSanitize(item.name) + "_");
                        
                        return hasStrictPrefix || (isUploadedByMatchingRole && startsWithItemName);
                    });

                    return {
                        ...item,
                        uploaded: matchingFiles.length > 0,
                        files: matchingFiles,
                    };
                });
            }
        });
        
        return currentStatus;
    }, []);

    React.useEffect(() => {
        const checklist = getParallelChecklistStatus(selectedProject);
        setParallelUploadChecklist(checklist);
    }, [selectedProject, getParallelChecklistStatus]);

    const finalDocsChecklistStatus = React.useMemo(() => {
        if (!selectedProject || selectedProject.status !== 'Pending Final Documents') return null;
        const projectFiles = selectedProject.files || [];

        return finalDocRequirements.map(reqName => {
            const prefix = safeSanitize("final_" + reqName) + "_";
            const matchingFiles = projectFiles.filter(file => {
                const fileNameOnDisk = getBaseName(file.path);
                return fileNameOnDisk.startsWith(prefix);
            });
            return {
                name: reqName,
                uploaded: matchingFiles.length > 0,
                files: matchingFiles,
            };
        });
    }, [selectedProject]);

  const formatTimestamp = React.useCallback((timestamp: string): string => {
    if (!isClient) return ''; 
    const locale = language === 'id' ? 'id-ID' : 'en-US';
    try {
      return new Date(timestamp).toLocaleString(locale, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: 'numeric', minute: 'numeric',
      });
    } catch (e) {
      return projectsDict.invalidDate || "Invalid Date";
    }
  }, [language, projectsDict, isClient]);

  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const getTranslatedStatus = React.useCallback((statusKey: string): string => {
        if (!dashboardDict?.status || !statusKey || typeof statusKey !== 'string') return statusKey || '';
        const key = statusKey?.toLowerCase().replace(/ /g,'') as keyof typeof dashboardDict.status;
        return dashboardDict.status[key] || statusKey;
    }, [dashboardDict]);

  const getStatusBadge = React.useCallback((status: string) => {
    if (!status || !dashboardDict?.status) return <Skeleton className="h-5 w-20" />;
    const statusKey = status.toLowerCase().replace(/ /g, '') as keyof typeof dashboardDict.status;
    const translatedStatus = dashboardDict.status[statusKey] || status;
    let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
    let className = "py-1 px-2 text-xs";
    let Icon = Clock;
    switch (statusKey) {
        case 'completed': variant = 'default'; className = `${className} bg-green-500 hover:bg-green-600 text-white`; Icon = CheckCircle; break;
        case 'inprogress': variant = 'secondary'; className = `${className} bg-blue-500 text-white`; Icon = Clock; break;
        case 'pendingapproval': variant = 'outline'; className = `${className} border-yellow-500 text-yellow-600`; Icon = AlertTriangle; break;
        case 'pendingpostsidangrevision': variant = 'outline'; className = `${className} border-orange-400 text-orange-500`; Icon = RefreshCw; break;
        case 'delayed': variant = 'destructive'; className = `${className} bg-orange-500 text-white`; Icon = Clock; break;
        case 'canceled': variant = 'destructive'; Icon = XCircle; break;
        case 'scheduled': variant = 'secondary'; className = `${className} bg-purple-500 text-white`; Icon = CalendarClock; break;
        case 'surveyscheduled': variant = 'secondary'; className = `${className} bg-cyan-500 text-white`; Icon = MapPin; break;
        case 'pendingparalleldesignuploads': variant = 'secondary'; className = `${className} bg-indigo-500 text-white`; Icon = Shield; break;
        default: variant = 'secondary'; Icon = Clock;
    }
    return <Badge variant={variant} className={className}><Icon className="mr-1 h-3 w-3" />{translatedStatus}</Badge>;
  }, [dashboardDict]);

  const actingRole = React.useMemo(() => {
    if (!currentUser || !Array.isArray(currentUser.roles) || !selectedProject) return null;
    const designRoles = ['Arsitek', 'Struktur', 'MEP'];
    const isParallelStage = ['Pending Parallel Design Uploads', 'Pending Post-Sidang Revision'].includes(selectedProject.status);
    if (isParallelStage) {
        const userDesignRole = currentUser.roles.find(r => designRoles.includes(r));
        if (userDesignRole) return userDesignRole;
    }
    if (currentUser.roles.includes(selectedProject.assignedDivision)) return selectedProject.assignedDivision;
    return currentUser.roles[0];
  }, [currentUser, selectedProject]);

  const uploadFileWithFormData = async (file: File, formDataPayload: Record<string, string | null>, onProgress: (percentage: number) => void): Promise<any> => {
    const CHUNK_SIZE = 5 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = `${file.name}-${file.lastModified}-${file.size}-${Math.random()}`;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        const chunkFormData = new FormData();
        chunkFormData.append('chunk', chunk);
        chunkFormData.append('chunkIndex', chunkIndex.toString());
        chunkFormData.append('totalChunks', totalChunks.toString());
        chunkFormData.append('originalFilename', file.name);
        chunkFormData.append('uploadId', uploadId);

        const response = await fetch(`${API_BASE_URL}/api/upload/stream`, { method: 'POST', body: chunkFormData });
        if (!response.ok) throw new Error(`Gagal mengunggah bagian ${chunkIndex}.`);

        const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
        onProgress(progress);
        
        if (chunkIndex === totalChunks - 1) {
            const lastChunkResponse = await response.json();
            const finalResponse = await fetch(`${API_BASE_URL}/api/upload-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formDataPayload,
                    tempPath: lastChunkResponse.tempPath,
                    originalFilename: lastChunkResponse.originalFilename,
                }),
            });
            if (!finalResponse.ok) throw new Error('Gagal menggabungkan file di server.');
            return finalResponse.json();
        }
    }
};

  const handleProgressSubmit = React.useCallback(async (actionTaken: string = 'submitted', filesToSubmit?: File[], descriptionForSubmit?: string, associatedChecklistItem?: string, divisionForFile?: string) => {
    if (!currentUser || !selectedProject) return;

    const currentFiles = filesToSubmit || uploadedFiles;
    const currentDescription = descriptionForSubmit || description;
    setIsSubmitting(true);

    try {
        if (currentFiles.length > 0) {
            // Uniquely identify the checklist item by combining division and name
            let finalAssociatedItem = associatedChecklistItem;
            if (divisionForFile && associatedChecklistItem) {
                finalAssociatedItem = `${divisionForFile}_${associatedChecklistItem}`;
            }

            for (const file of currentFiles) {
                const formDataPayload: Record<string, string | null> = {
                  projectId: selectedProject.id,
                  userId: currentUser.id,
                  uploaderRole: actingRole || currentUser.roles[0],
                  note: currentDescription,
                  associatedChecklistItem: finalAssociatedItem || null,
                };
                await uploadFileWithFormData(file, formDataPayload, (p) => console.log(`Progres ${file.name}: ${p}%`));
            }
        }
        
        const updatePayload: UpdateProjectParams = {
            projectId: selectedProject.id,
            updaterRoles: currentUser.roles,
            updaterUsername: currentUser.username,
            actionTaken: actionTaken,
            note: currentDescription || undefined, 
            scheduleDetails: (selectedProject.status === 'Pending Scheduling' && actionTaken === 'scheduled' && scheduleDate) ? {
                date: format(scheduleDate, 'yyyy-MM-dd'),
                time: scheduleTime,
                location: scheduleLocation
            } : undefined,
             surveyDetails: (selectedProject.status === 'Pending Survey Details' || selectedProject.status === 'Survey Scheduled') && actionTaken === 'submitted' ? {
                date: surveyDate ? format(surveyDate, 'yyyy-MM-dd') : '',
                time: surveyTime,
                description: surveyDescription
            } : undefined,
        };

        const response = await fetch(`${API_BASE_URL}/api/projects/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
        });

        if (!response.ok) throw new Error('Pembaruan status gagal');
        toast({ title: projectsDict.toast.progressSubmitted });

        setDescription('');
        setUploadedFiles([]);
        if (uploadDialogState.isOpen) setUploadDialogState({ isOpen: false, item: null, division: null });

        const newlyUpdatedProject = await fetchProjectById(selectedProject.id);
        if (newlyUpdatedProject) {
            setAllProjects(prev => prev.map(p => p.id === newlyUpdatedProject.id ? newlyUpdatedProject : p));
            setSelectedProject(newlyUpdatedProject); 
        }
      } catch (error: any) {
         toast({ variant: 'destructive', title: projectsDict.toast.updateError, description: error.message });
      } finally {
        setIsSubmitting(false);
      }
  }, [currentUser, selectedProject, uploadedFiles, description, scheduleDate, scheduleTime, scheduleLocation, surveyDate, surveyTime, surveyDescription, projectsDict, toast, actingRole, uploadDialogState, fetchProjectById]);

  const handleDecision = React.useCallback((decision: string) => {
    if (!currentUser || !selectedProject ) return;
    handleProgressSubmit(decision);
  }, [currentUser, selectedProject, handleProgressSubmit]);

  const roleFilteredProjects = React.useMemo(() => {
        if (!currentUser || !Array.isArray(currentUser.roles)) return [];
        const adminRoles = ['Owner', 'Akuntan', 'Admin Proyek', 'Admin Developer'];
        if (currentUser.roles.some(role => adminRoles.includes(role))) return allProjects;
        return allProjects.filter(project => {
            if (['Pending Parallel Design Uploads', 'Pending Post-Sidang Revision'].includes(project.status)) return currentUser.roles.some(role => ['Arsitek', 'Struktur', 'MEP'].includes(role));
            return currentUser.roles.some(role => role === project.assignedDivision?.trim());
        });
    }, [currentUser, allProjects]);

    React.useEffect(() => {
        let current = roleFilteredProjects;
        if (statusFilter.length > 0) current = current.filter(p => statusFilter.includes(p.status));
        if (searchTerm.trim() !== '') current = current.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()));
        setDisplayedProjects(current);
    }, [searchTerm, statusFilter, roleFilteredProjects]);

    const handleDownloadFile = React.useCallback(async (file: FileEntry) => {
        setIsDownloading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/download-file?filePath=${encodeURIComponent(file.path)}`);
            if (!response.ok) throw new Error('Download gagal');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = file.name;
            document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
            toast({ title: "Unduhan Dimulai" });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Kesalahan", description: error.message });
        } finally {
            setIsDownloading(false);
        }
    }, [toast]);

    const handleDeleteFile = React.useCallback(async (filePath: string, fileName: string) => {
        if (!selectedProject || !currentUser) return;
        setIsDeletingFile(filePath);
        try {
            const response = await fetch(`${API_BASE_URL}/api/delete-file`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: selectedProject.id, filePath, userId: currentUser.id })
            });
            if (!response.ok) throw new Error('Gagal menghapus file');
            const updated = await fetchProjectById(selectedProject.id);
            if (updated) { setAllProjects(prev => prev.map(p => p.id === updated.id ? updated : p)); setSelectedProject(updated); }
            toast({ title: "File Dihapus" });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Kesalahan", description: error.message });
        } finally {
            setIsDeletingFile(null);
        }
    }, [selectedProject, currentUser, toast, fetchProjectById]);

    const handleDivisionCompletion = React.useCallback(async () => {
        if (!selectedProject || !currentUser) return;
        setIsSubmitting(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/projects/update`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ specialAction: 'markDivisionComplete', projectId: selectedProject.id, updaterRoles: currentUser.roles, updaterUsername: currentUser.username }),
            });
            if (!response.ok) throw new Error('Gagal memperbarui status divisi');
            const updated = await fetchProjectById(selectedProject.id);
            if (updated) { setAllProjects(prev => prev.map(p => p.id === updated.id ? updated : p)); setSelectedProject(updated); }
            toast({ title: "Tugas Divisi Selesai" });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Kesalahan", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedProject, currentUser, toast, fetchProjectById]);

    const allChecklistItemsUploaded = React.useMemo(() => {
        if (!parallelUploadChecklist) return false;
        return Object.values(parallelUploadChecklist).every(divItems => divItems?.every(item => item.uploaded));
    }, [parallelUploadChecklist]);

    const translateHistoryAction = React.useCallback((action: string): string => {
        if (!action || !projectsDict.workflowActions) return action || '';
        let res = action;
        const createdMatch = action.match(/^(Created Project with workflow|Proyek dibuat dengan alur kerja): (.*)$/i);
        if (createdMatch) res = (projectsDict.workflowActions.createdProjectWithWorkflow || "Created Project with workflow: {workflowId}").replace('{workflowId}', createdMatch[2]);
        return res;
    }, [projectsDict.workflowActions]);

    const groupedAndSortedHistory = React.useMemo(() => {
        if (!selectedProject) return [];
        const grouped = new Map<string, GroupedHistoryItem>();
        (selectedProject.workflowHistory || []).forEach(e => {
            if (!grouped.has(e.timestamp)) grouped.set(e.timestamp, { timestamp: e.timestamp, entries: [], files: [] });
            grouped.get(e.timestamp)!.entries.push(e);
        });
        (selectedProject.files || []).forEach(f => {
            if (!grouped.has(f.timestamp)) grouped.set(f.timestamp, { timestamp: f.timestamp, entries: [], files: [] });
            grouped.get(f.timestamp)!.files.push(f);
        });
        return Array.from(grouped.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [selectedProject]);

    const allFinalDocsUploaded = React.useMemo(() => {
        if (!finalDocsChecklistStatus) return false;
        return finalDocsChecklistStatus.every(item => item.uploaded);
    }, [finalDocsChecklistStatus]);

  if (!isClient) return null;

  const renderProjectList = () => (
      <Card className="shadow-md">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-xl md:text-2xl">{projectsDict.projectListTitle}</CardTitle>
              <CardDescription>{projectsDict.projectListDescription}</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-grow sm:flex-grow-0">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="search" placeholder={projectsDict.searchPlaceholder} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 w-full sm:w-[200px] md:w-[250px]"/>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="outline" className="w-full sm:w-auto"><ListFilter className="mr-2 h-4 w-4" />{projectsDict.filterButton}</Button></DropdownMenuTrigger>
                   <DropdownMenuContent className="w-56">
                    {projectStatuses.map(s => (<DropdownMenuCheckboxItem key={s} checked={statusFilter.includes(s)} onCheckedChange={() => setStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}>{getTranslatedStatus(s)}</DropdownMenuCheckboxItem>))}
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="space-y-4">
            {displayedProjects.map(p => (
                <Card key={p.id} className="hover:shadow-lg transition-all cursor-pointer" onClick={() => {setSelectedProject(p); router.push(`/dashboard/projects?projectId=${p.id}`, { scroll: false }); }}>
                   <CardHeader className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between p-4 pb-2">
                        <div className="flex-1 min-w-0"><CardTitle className="text-base sm:text-lg">{p.title}</CardTitle><CardDescription className="text-xs text-muted-foreground mt-1">{projectsDict.assignedLabel}: {getTranslatedStatus(p.assignedDivision)}</CardDescription></div>
                        <div className="flex-shrink-0 pt-2 sm:pt-0">{getStatusBadge(p.status)}</div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2"><div className="flex items-center gap-2"><Progress value={p.progress} className="w-full h-2" /><span className="text-xs text-muted-foreground font-medium">{p.progress}%</span></div></CardContent>
                </Card>
            ))}
          </div>
        </CardContent>
      </Card>
  );

  const renderChecklistItem = (item: ChecklistItem, division: string) => {
      const canAdminDelete = currentUser?.roles.some(r => ['Admin Proyek', 'Owner', 'Admin Developer'].includes(r));
      return (
        <li key={`${division}-${item.name}`} className="flex text-sm p-2 border rounded-md gap-2 flex-col items-start">
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {item.uploaded ? <CheckCircle className="h-4 w-4 text-green-500" /> : <CircleIcon className="h-4 w-4 text-muted-foreground" />}
              <span className={cn("truncate font-medium", item.uploaded ? "text-foreground" : "text-muted-foreground")}>{item.name}</span>
            </div>
            {currentUser?.roles.includes(division) && (
                <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setUploadDialogState({ isOpen: true, item, division })} disabled={isSubmitting}><Upload className="h-3 w-3" /></Button>
            )}
          </div>
          {item.files.length > 0 && (
            <ul className="pl-6 pt-1 space-y-1 w-full border-t mt-1">
              {item.files.map(file => (
                  <li key={file.path} className="flex justify-between items-center text-xs text-muted-foreground hover:text-foreground">
                    <span className="truncate pr-2">{file.name}</span>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleDownloadFile(file)} className="h-6 w-6" disabled={isDownloading}><Download className="h-3 w-3 text-primary" /></Button>
                        {(canAdminDelete || currentUser?.roles.includes(file.uploadedBy || '')) && (
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteFile(file.path, file.name)} className="h-6 w-6" disabled={!!isDeletingFile}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                        )}
                    </div>
                  </li>
              ))}
            </ul>
          )}
        </li>
      );
  };

  const renderSelectedProjectDetail = (project: Project) => {
       return (
           <>
                <Button variant="outline" onClick={() => {setSelectedProject(null); router.push('/dashboard/projects', { scroll: false });}} className="mb-4 w-full sm:w-auto"><ArrowLeft className="mr-2 h-4 w-4" />{projectsDict.backToList}</Button>
                <Card className="shadow-md mb-6">
                   <CardHeader className="p-4 sm:p-6">
                     <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                        <div className="flex-1 min-w-0"><CardTitle className="text-xl md:text-2xl">{project.title}</CardTitle><CardDescription className="mt-1">{projectsDict.statusLabel}: {getStatusBadge(project.status)}</CardDescription></div>
                        <div className="text-left md:text-right w-full md:w-auto"><div className="text-sm font-medium">{projectsDict.progressLabel}</div><div className="flex items-center gap-2 mt-1"><Progress value={project.progress} className="w-full md:w-32 h-2" /><span className="text-xs text-muted-foreground font-medium">{project.progress}%</span></div></div>
                     </div>
                   </CardHeader>
                </Card>

                {(project.status === 'Pending Parallel Design Uploads' || project.status === 'Pending Post-Sidang Revision') && parallelUploadChecklist && (
                    <Card className="mb-6 shadow-md">
                        <CardHeader className="p-4 sm:p-6"><CardTitle>{projectsDict.fileChecklist.title}</CardTitle></CardHeader>
                        <CardContent className="p-4 sm:p-6 pt-0 grid grid-cols-1 md:grid-cols-3 gap-6">
                            {(Object.entries(parallelUploadChecklist)).map(([division, items]) => (
                                <div key={division}>
                                    <div className="flex justify-between items-center mb-2"><h4 className="font-semibold">{getTranslatedStatus(division)}</h4>
                                        {currentUser?.roles.includes(division) && (<Button size="sm" variant="outline" onClick={handleDivisionCompletion} disabled={isSubmitting || project.parallelUploadsCompletedBy?.includes(division)}>{project.parallelUploadsCompletedBy?.includes(division) ? <Check className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}{project.parallelUploadsCompletedBy?.includes(division) ? "Selesai" : "Tandai Selesai"}</Button>)}
                                    </div>
                                    <ul className="space-y-2">{items?.map(item => renderChecklistItem(item, division))}</ul>
                                </div>
                            ))}
                        </CardContent>
                         {currentUser?.roles.includes('Admin Proyek') && project.status === 'Pending Parallel Design Uploads' && (<CardFooter className="p-4 sm:p-6 pt-0"><Button onClick={() => handleProgressSubmit('all_files_confirmed')} disabled={isSubmitting || !allChecklistItemsUploaded} className="w-full sm:w-auto accent-teal"><CheckCircle className="mr-2 h-4 w-4" />Konfirmasi Semua Desain</Button></CardFooter>)}
                    </Card>
                )}

                 <Card className="mb-6 shadow-md">
                    <CardHeader className="p-4 sm:p-6"><CardTitle>{projectsDict.workflowHistoryTitle}</CardTitle></CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0">
                        <Accordion type="single" collapsible className="w-full">
                             {groupedAndSortedHistory.map((group, index) => (
                                <AccordionItem value={`item-${index}`} key={group.timestamp}>
                                    <AccordionTrigger disabled={group.files.length === 0}>
                                        <div className="flex items-start gap-3 flex-1 text-left">
                                            <div className={`mt-1 h-3 w-3 rounded-full flex-shrink-0 ${index === 0 ? 'bg-primary animate-pulse' : 'bg-muted'}`}></div>
                                            <div>{group.entries.map((e, ei) => (<p key={ei} className="text-sm font-medium">{translateHistoryAction(e.action)}</p>))}<p className="text-xs text-muted-foreground" suppressHydrationWarning>{formatTimestamp(group.timestamp)}</p></div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <ul className="pl-6 pt-2 space-y-2">
                                            {group.files.map((file, fi) => (<li key={fi} className="flex items-center justify-between p-2 border rounded-md hover:bg-muted gap-2"><div className="flex items-center gap-2 min-w-0"><FileText className="h-4 w-4 text-primary flex-shrink-0" /><span className="text-sm truncate">{file.name}</span></div><Button variant="ghost" size="icon" onClick={() => handleDownloadFile(file)} className="h-7 w-7" disabled={isDownloading}><Download className="h-4 w-4 text-primary" /></Button></li>))}
                                        </ul>
                                    </AccordionContent>
                                </AccordionItem>
                             ))}
                        </Accordion>
                    </CardContent>
                </Card>

                {project.status === 'Pending Final Documents' && finalDocsChecklistStatus && (
                    <Card className="mb-6 shadow-md border-primary/20">
                        <CardHeader className="p-4 sm:p-6"><CardTitle>Unggah Dokumen Akhir</CardTitle></CardHeader>
                        <CardContent className="p-4 sm:p-6 pt-0 space-y-4"><ul className="space-y-2">{finalDocsChecklistStatus.map((item) => (
                             <li key={`final-${item.name}`} className="flex text-sm p-2 border rounded-md gap-2 flex-col items-start">
                               <div className="flex justify-between items-center w-full">
                                 <div className="flex items-center gap-2 flex-1 min-w-0">{item.uploaded ? <CheckCircle className="h-4 w-4 text-green-500" /> : <CircleIcon className="h-4 w-4 text-muted-foreground" />}<span className={cn("truncate", item.uploaded ? "text-foreground font-medium" : "text-muted-foreground")}>{item.name}</span></div>
                                 {(currentUser?.roles.some(r => ['Admin Proyek', 'Owner', 'Akuntan'].includes(r))) && (<Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setUploadDialogState({ isOpen: true, item, division: 'final' })} disabled={isSubmitting}><Upload className="h-3 w-3" /></Button>)}
                               </div>
                               {item.files.length > 0 && (<ul className="pl-6 pt-1 space-y-1 w-full border-t mt-1">{item.files.map(f => (<li key={f.path} className="flex justify-between items-center text-xs"><span className="truncate pr-2">{f.name}</span><div className="flex items-center gap-1"><Button variant="ghost" size="icon" onClick={() => handleDownloadFile(f)} className="h-6 w-6" disabled={isDownloading}><Download className="h-3 w-3 text-primary" /></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteFile(f.path, f.name)} className="h-6 w-6" disabled={!!isDeletingFile}><Trash2 className="h-3 w-3 text-destructive" /></Button></div></li>))}</ul>)}
                             </li>
                        ))}</ul></CardContent>
                        {currentUser?.roles.includes('Admin Proyek') && (<CardFooter className="p-4 sm:p-6 border-t"><Button onClick={() => handleDecision('completed')} disabled={isSubmitting || !allFinalDocsUploaded} className="w-full sm:w-auto accent-teal"><CheckCircle className="mr-2 h-4 w-4" />Selesaikan Proyek</Button></CardFooter>)}
                    </Card>
                )}

                <Dialog open={uploadDialogState.isOpen} onOpenChange={o => { if (!isSubmitting) setUploadDialogState(s => ({ ...s, isOpen: o })); }}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Unggah: {uploadDialogState.item?.name}</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                          <Textarea placeholder="Catatan (opsional)..." value={description} onChange={e => setDescription(e.target.value)} disabled={isSubmitting}/>
                          <Input type="file" multiple onChange={(e) => { if (e.target.files) setUploadedFiles(Array.from(e.target.files)); }} disabled={isSubmitting} />
                          {uploadedFiles.length > 0 && (<div className="space-y-1 rounded-md border p-2">{uploadedFiles.map((f, i) => (<div key={i} className="flex justify-between items-center text-xs p-1"><span>{f.name}</span><Button variant="ghost" size="sm" onClick={() => removeFile(i)} className="h-6 w-6" disabled={isSubmitting}><Trash2 className="h-3 w-3 text-destructive" /></Button></div>))}</div>)}
                        </div>
                        <DialogFooter><Button variant="outline" onClick={() => { setUploadDialogState({ isOpen: false, item: null, division: null }); setUploadedFiles([]); setDescription(''); }} disabled={isSubmitting}>Batal</Button><Button onClick={() => handleProgressSubmit('submitted', uploadedFiles, description, uploadDialogState.item?.name, uploadDialogState.division || undefined)} disabled={isSubmitting || uploadedFiles.length === 0}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Unggah</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
           </>
       );
  }

  return (
    <div className="container mx-auto py-4 px-4 md:px-6 space-y-6">
      {selectedProject ? renderSelectedProjectDetail(selectedProject) : renderProjectList()}
    </div>
  );
}
