// src/components/dashboard/ProjectsPageClient.tsx
'use client';

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
  Send,
  CheckCircle,
  XCircle,
  FileText,
  Trash2,
  CalendarClock,
  Loader2,
  AlertTriangle,
  ListFilter,
  ArrowRight,
  Clock,
  ArrowLeft,
  Download,
  RefreshCw,
  Search,
  Replace,
  Briefcase,
  MapPin,
  Shield,
  Circle as CircleIcon,
  Wrench,
  Check,
  FileLock,
  CalendarIcon,
  Banknote
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
  DialogTrigger,
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
import { Skeleton } from '@/components/ui/skeleton';
import type { Project, WorkflowHistoryEntry, FileEntry, UpdateProjectParams } from '@/types/project-types';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { useSearchParams, useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ToastAction } from '@/components/ui/toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format, parseISO } from 'date-fns';
import { id as IndonesianLocale, enUS as EnglishLocale } from 'date-fns/locale';
import { addFilesToProject as addFilesToProjectService } from '@/services/project-service';
import { API_BASE_URL } from '@/config/api-config';


const defaultGlobalDict = getDictionary('en');

const projectStatuses = [
    'Pending Offer', 'Pending Approval', 'Pending DP Invoice',
    'Pending Admin Files', 'Pending Survey Details', 'Survey Scheduled', 'Pending Architect Files', 'Pending Structure Files', 'Pending MEP Files',
    'Pending Scheduling', 'Scheduled', 'Pending Post-Sidang Revision', 'Pending Parallel Design Uploads',
    'In Progress', 'Completed', 'Canceled', 'Pending Consultation Docs', 'Pending Review', 'Pending Final Documents', 'Pending Pelunasan Invoice', 'Pending Sidang Registration Proof'
];

interface ChecklistItem {
    name: string;
    uploaded: boolean;
    filePath?: string;
    uploadedBy?: string;
    originalFileName?: string;
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

interface UploadDialogState {
  isOpen: boolean;
  item: ChecklistItem | null;
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
  const settingsDict = React.useMemo(() => dict.settingsPage, [dict]);


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

  const [isAddingToCalendar, setIsAddingToCalendar] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [revisionNote, setRevisionNote] = React.useState('');
  const [isRevising, setIsRevising] = React.useState(false);

  const [statusFilter, setStatusFilter] = React.useState<string[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [displayedProjects, setDisplayedProjects] = React.useState<Project[]>([]);

  const [isInitialImageUploadDialogOpen, setIsInitialImageUploadDialogOpen] = React.useState(false);
  const [initialImageFiles, setInitialImageFiles] = React.useState<File[]>([]);
  const [initialImageDescription, setInitialImageDescription] = React.useState('');
  const [isSubmittingInitialImages, setIsSubmittingInitialImages] = React.useState(false);
  
  const [parallelUploadChecklist, setParallelUploadChecklist] = React.useState<ParallelUploadChecklist | null>(null);

  const [isPostSidangRevisionDialogOpen, setIsPostSidangRevisionDialogOpen] = React.useState(false);
  const [postSidangRevisionNote, setPostSidangRevisionNote] = React.useState('');
  const [postSidangRevisionFiles, setPostSidangRevisionFiles] = React.useState<File[]>([]);

  const [isDeletingFile, setIsDeletingFile] = React.useState<string | null>(null);

  const [isGenericRevisionDialogOpen, setIsGenericRevisionDialogOpen] = React.useState(false);
  
  const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = React.useState(false);
  const [rescheduleDate, setRescheduleDate] = React.useState<Date | undefined>();
  const [rescheduleTime, setRescheduleTime] = React.useState('');
  const [rescheduleNote, setRescheduleNote] = React.useState('');

  const [isRescheduleFromParallelDialogOpen, setIsRescheduleFromParallelDialogOpen] = React.useState(false);
  const [rescheduleFromParallelNote, setRescheduleFromParallelNote] = React.useState('');
  
  const [adminFiles, setAdminFiles] = React.useState<File[]>([]);
  const [adminFileNote, setAdminFileNote] = React.useState('');
  const [isUploadingAdminFiles, setIsUploadingAdminFiles] = React.useState(false);
  
  const [uploadDialogState, setUploadDialogState] = React.useState<UploadDialogState>({ isOpen: false, item: null, division: null });

  const [isClient, setIsClient] = React.useState(false);
  React.useEffect(() => { setIsClient(true); }, []);


  const projectIdFromUrl = searchParams.get('projectId');

  const fetchAllProjects = React.useCallback(async () => {
    setIsLoadingProjects(true);
    try {
        const response = await fetch(`${API_BASE_URL}/api/projects`);
        if (!response.ok) {
            throw new Error('Failed to fetch projects');
        }
        const data = await response.json();
        setAllProjects(data);
    } catch (error) {
        console.error("Failed to fetch projects:", error);
        toast({ variant: 'destructive', title: projectsDict.toast.error, description: projectsDict.toast.couldNotLoadProjects });
    } finally {
        setIsLoadingProjects(false);
    }
  }, [toast, projectsDict.toast.error, projectsDict.toast.couldNotLoadProjects]);

  React.useEffect(() => {
    const handleDataRefresh = () => {
      console.log('`refresh-data` event received, refetching projects...');
      fetchAllProjects();
    };

    window.addEventListener('refresh-data', handleDataRefresh);

    return () => {
      window.removeEventListener('refresh-data', handleDataRefresh);
    };
  }, [fetchAllProjects]);

  const fetchProjectById = React.useCallback(async (id: string): Promise<Project | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch project ${id}`);
      }
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
          setDescription('');
          setUploadedFiles([]);
          setScheduleDate(projectToSelect.scheduleDetails?.date ? parseISO(projectToSelect.scheduleDetails.date) : undefined);
          setScheduleTime(projectToSelect.scheduleDetails?.time || '');
          setScheduleLocation(projectToSelect.scheduleDetails?.location || '');
          setSurveyDate(projectToSelect.surveyDetails?.date ? parseISO(projectToSelect.surveyDetails.date) : undefined);
          setSurveyTime(projectToSelect.surveyDetails?.time || '');
          setSurveyDescription(projectToSelect.surveyDetails?.description || '');
          setRevisionNote('');
          setInitialImageFiles([]);
          setInitialImageDescription('');
        } else {
          console.warn(`Project with ID "${projectIdFromUrl}" from URL not found.`);
          toast({ variant: 'destructive', title: projectsDict.toast.error, description: projectsDict.toast.projectNotFound });
          router.replace('/dashboard/projects', { scroll: false });
        }
      } else {
        setSelectedProject(null);
      }
    }
  }, [projectIdFromUrl, allProjects, router, toast, projectsDict.toast.error, projectsDict.toast.projectNotFound]);

    const getParallelChecklistStatus = React.useCallback((project: Project | null): ParallelUploadChecklist | null => {
        if (!project) return null;

        const isParallelStatus = project.workflowId === 'msa_workflow' && project.status === 'Pending Parallel Design Uploads';
        const isRevisionStatus = project.status === 'Pending Post-Sidang Revision';

        if (!isParallelStatus && !isRevisionStatus) {
            return null;
        }

        const requiredChecklists: ParallelUploadChecklist = {
            Arsitek: [
                { name: 'Gambar', uploaded: false },
                { name: 'Daftar Simak', uploaded: false },
                { name: 'SpekTek', uploaded: false },
                { name: 'RAP', uploaded: false }
            ],
            Struktur: [
                { name: 'Gambar', uploaded: false },
                { name: 'Analisa Laporan', uploaded: false },
                { name: 'Hammer Test', uploaded: false },
                { name: 'SpekTek', uploaded: false },
                { name: 'Daftar Simak', uploaded: false }
            ],
            MEP: [
                { name: 'Gambar', uploaded: false },
                { name: 'Daftar Simak', uploaded: false },
                { name: 'SpekTek', uploaded: false },
                { name: 'RAP', uploaded: false },
                { name: 'Laporan', uploaded: false }
            ],
        };
        
        const currentStatus: ParallelUploadChecklist = {};
        const projectFiles = project.files || [];

        (Object.keys(requiredChecklists) as (keyof ParallelUploadChecklist)[]).forEach(division => {
            const checklistItems = requiredChecklists[division];
            if (checklistItems) {
                const divisionFiles = projectFiles.filter(file => file.uploadedBy === division);

                currentStatus[division] = checklistItems.map(item => {
                    const itemNameKeywords = item.name.toLowerCase().split(' ').filter(k => k);
                    const uploadedFile = divisionFiles.find(file => {
                        const fileNameLower = file.name.toLowerCase();
                        // This logic becomes a fallback or can be adjusted.
                        // The primary association will be through the explicit upload action.
                        // For now, we check if the file name CONTAINS keywords.
                        return itemNameKeywords.every(keyword => fileNameLower.includes(keyword));
                    });
                    return {
                        ...item,
                        uploaded: !!uploadedFile,
                        filePath: uploadedFile?.path,
                        uploadedBy: uploadedFile?.uploadedBy,
                        originalFileName: uploadedFile?.name,
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


  const formatTimestamp = React.useCallback((timestamp: string): string => {
    if (!projectsDict?.invalidDate) return '...';
    const locale = language === 'id' ? 'id-ID' : 'en-US';
    try {
      return new Date(timestamp).toLocaleString(locale, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: 'numeric', minute: 'numeric',
      });
    } catch (e) {
      console.error("Error formatting timestamp:", timestamp, e);
      return projectsDict.invalidDate || "Invalid Date";
    }
  }, [language, projectsDict]);

   const formatDateOnly = React.useCallback((timestamp: string | undefined | null): string => {
      if (!projectsDict?.notApplicable) return "...";
      if (!timestamp) return projectsDict?.notApplicable || "N/A";
      const locale = language === 'id' ? 'id-ID' : 'en-US';
      try {
            return new Date(timestamp).toLocaleDateString(locale, {
                year: 'numeric', month: 'short', day: 'numeric',
            });
        } catch (e) {
            console.error("Error formatting date:", timestamp, e);
            return projectsDict.invalidDate || "Invalid Date";
        }
   }, [language, projectsDict]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const filesArray = Array.from(event.target.files);
      setUploadedFiles(prevFiles => [...prevFiles, ...filesArray]);
    }
  };
  
  const handleAdminFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const filesArray = Array.from(event.target.files);
      setAdminFiles(prevFiles => [...prevFiles, ...filesArray]);
    }
  };


  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };
  
  const removeAdminFile = (index: number) => {
    setAdminFiles(adminFiles.filter((_, i) => i !== index));
  };
  
  const handleInitialImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
        const filesArray = Array.from(event.target.files);
        setInitialImageFiles(prevFiles => [...prevFiles, ...filesArray]);
    }
  };

  const removeInitialImageFile = (index: number) => {
    setInitialImageFiles(initialImageFiles.filter((_, i) => i !== index));
  };
  
  const handlePostSidangRevisionFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const filesArray = Array.from(event.target.files);
      setPostSidangRevisionFiles(prevFiles => [...prevFiles, ...filesArray]);
    }
  };
  
  const removePostSidangRevisionFile = (index: number) => {
    setPostSidangRevisionFiles(postSidangRevisionFiles.filter((_, i) => i !== index));
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
        case 'completed': variant = 'default'; className = `${className} bg-green-500 hover:bg-green-600 text-white dark:bg-green-600 dark:hover:bg-green-700 dark:text-primary-foreground`; Icon = CheckCircle; break;
        case 'inprogress': variant = 'secondary'; className = `${className} bg-blue-500 text-white dark:bg-blue-600 dark:text-primary-foreground hover:bg-blue-600 dark:hover:bg-blue-700`; Icon = Clock; break;
        case 'pendingapproval': variant = 'outline'; className = `${className} border-yellow-500 text-yellow-600 dark:border-yellow-400 dark:text-yellow-500`; Icon = AlertTriangle; break;
        case 'pendingpostsidangrevision': variant = 'outline'; className = `${className} border-orange-400 text-orange-500 dark:border-orange-300 dark:text-orange-400`; Icon = RefreshCw; break;
        case 'delayed': variant = 'destructive'; className = `${className} bg-orange-500 text-white dark:bg-orange-600 dark:text-primary-foreground hover:bg-orange-600 dark:hover:bg-orange-700 border-orange-500 dark:border-orange-600`; Icon = Clock; break;
        case 'canceled': variant = 'destructive'; Icon = XCircle; break;
        case 'pending':
        case 'pendinginitialinput':
        case 'pendingoffer': variant = 'outline'; className = `${className} border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-500`; Icon = Clock; break;
        case 'pendingdpinvoice':
        case 'pendingadminfiles':
        case 'pendingsurveydetails':
        case 'pendingarchitectfiles':
        case 'pendingstructurefiles':
        case 'pendingmepfiles':
        case 'pendingfinalcheck':
        case 'pendingsidangregistrationproof': variant = 'secondary'; Icon = Clock; break;
        case 'pendingscheduling':
        case 'pendingconsultationdocs':
        case 'pendingreview':
        case 'pendingfinaldocuments': 
        case 'pendingpelunasaninvoice': variant = 'secondary'; Icon = Clock; break;
        case 'pendingparalleldesignuploads': variant = 'secondary'; className = `${className} bg-indigo-500 text-white dark:bg-indigo-600 dark:text-primary-foreground hover:bg-indigo-600 dark:hover:bg-indigo-700`; Icon = Shield; break;
        case 'scheduled': variant = 'secondary'; className = `${className} bg-purple-500 text-white dark:bg-purple-600 dark:text-primary-foreground hover:bg-purple-600 dark:hover:bg-purple-700`; Icon = CalendarClock; break;
        case 'surveyscheduled': variant = 'secondary'; className = `${className} bg-cyan-500 text-white dark:bg-cyan-600 dark:text-primary-foreground hover:bg-cyan-600 dark:hover:bg-cyan-700`; Icon = MapPin; break;
        default: variant = 'secondary'; Icon = Clock;
    }
    return <Badge variant={variant} className={className}><Icon className="mr-1 h-3 w-3" />{translatedStatus}</Badge>;
  }, [dashboardDict]);

  const canPerformSelectedProjectAction = React.useMemo(() => {
    if (!currentUser || !Array.isArray(currentUser.roles) || !selectedProject) return false;
    
    // Explicitly allow Owner and Admin Proyek to act on 'Scheduled' status
    if (selectedProject.status === 'Scheduled' && (currentUser.roles.includes('Owner') || currentUser.roles.includes('Admin Proyek'))) {
        return true;
    }

    if (currentUser.roles.includes('Admin Developer') || currentUser.roles.includes('Owner')) {
      return true;
    }

    const assignedDivisionCleaned = selectedProject.assignedDivision?.trim();
    return currentUser.roles.some(role => role === assignedDivisionCleaned);
}, [currentUser, selectedProject]);
  
  const actingRole = React.useMemo(() => {
    if (!currentUser || !Array.isArray(currentUser.roles) || !selectedProject) {
        return null;
    }

    const designRoles = ['Arsitek', 'Struktur', 'MEP'];
    const isParallelStage = ['Pending Parallel Design Uploads', 'Pending Post-Sidang Revision'].includes(selectedProject.status);

    if (isParallelStage) {
        const userDesignRole = currentUser.roles.find(r => designRoles.includes(r));
        if (userDesignRole) {
            return userDesignRole;
        }
    }
    
    if (currentUser.roles.includes(selectedProject.assignedDivision)) {
        return selectedProject.assignedDivision;
    }
    
    return currentUser.roles[0];
  }, [currentUser, selectedProject]);

  const uploadFileWithFormData = async (file: File, formDataPayload: Record<string, string | null>): Promise<any> => {
      const formData = new FormData();
      formData.append('file', file);
      for (const key in formDataPayload) {
          if (formDataPayload[key] !== null) {
              formData.append(key, formDataPayload[key]!);
          }
      }

      const response = await fetch(`${API_BASE_URL}/api/upload-file`, {
          method: 'POST',
          body: formData,
      });

      if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: `Server error: ${response.statusText}` }));
          throw new Error(errorData.message || `Failed to upload ${file.name}.`);
      }
      return response.json();
  };

  const handleProgressSubmit = React.useCallback(async (actionTaken: string = 'submitted', filesToSubmit?: File[], descriptionForSubmit?: string, associatedChecklistItem?: string, divisionForFile?: string) => {
    if (!currentUser || !Array.isArray(currentUser.roles) || !selectedProject) {
      toast({ variant: 'destructive', title: projectsDict.toast.permissionDenied, description: projectsDict.toast.notYourTurn });
      return;
    }

    const currentFiles = filesToSubmit || uploadedFiles;
    const currentDescription = descriptionForSubmit || description;

    const isDecisionOrTerminalAction = ['approved', 'rejected', 'completed', 'revise_offer', 'revise_dp', 'canceled_after_sidang', 'revision_completed_proceed_to_invoice', 'all_files_confirmed', 'reschedule_sidang'].includes(actionTaken);
    const isSchedulingAction = actionTaken === 'scheduled' || actionTaken === 'reschedule_survey' || actionTaken === 'reschedule_survey_from_parallel';
    const isSurveySchedulingAction = selectedProject.status === 'Pending Survey Details' && actionTaken === 'submitted';
    const isArchitectInitialImageUpload = actionTaken === 'architect_uploaded_initial_images_for_struktur';
    
    setIsSubmitting(true);
    if (isArchitectInitialImageUpload) setIsSubmittingInitialImages(true);

    let newlyUpdatedProject: Project | null = null;
    let hadError = false;

    try {
        if (!isDecisionOrTerminalAction && !isSchedulingAction && !isSurveySchedulingAction && !isArchitectInitialImageUpload && !currentDescription && currentFiles.length === 0 ) {
          toast({ variant: 'destructive', title: projectsDict.toast.missingInput, description: projectsDict.toast.provideDescOrFile });
          hadError = true;
          return;
        }
        if (currentUser.roles.includes('Admin Proyek') && selectedProject.status === 'Pending Offer' && currentFiles.length === 0 && actionTaken === 'submitted') {
            toast({ variant: 'destructive', title: projectsDict.toast.missingInput, description: projectsDict.toast.provideOfferFile });
            hadError = true;
            return;
        }

        // New Logic: Upload files one by one using FormData
        if (currentFiles.length > 0) {
            for (const file of currentFiles) {
                const formDataPayload: Record<string, string | null> = {
                  projectId: selectedProject.id,
                  userId: currentUser.id,
                  uploaderRole: divisionForFile || actingRole || currentUser.roles[0],
                  note: currentDescription, // The note is associated with each file upload
                  associatedChecklistItem: associatedChecklistItem || null,
                };
                try {
                  await uploadFileWithFormData(file, formDataPayload);
                } catch (error: any) {
                    console.error("Error uploading file:", file.name, error);
                    toast({ variant: 'destructive', title: projectsDict.toast.uploadError, description: error.message });
                    hadError = true;
                    return; // Stop on first upload error
                }
            }
        }
        
        // After all files are uploaded (or if no files), submit the final workflow update
        const updatePayload: UpdateProjectParams = {
            projectId: selectedProject.id,
            updaterRoles: currentUser.roles,
            updaterUsername: currentUser.username,
            actionTaken: actionTaken,
            note: currentFiles.length > 0 ? undefined : (currentDescription || undefined), // Only send note if no files were part of this action
            scheduleDetails: (selectedProject.status === 'Pending Scheduling' && actionTaken === 'scheduled' && scheduleDate) ? {
                date: format(scheduleDate, 'yyyy-MM-dd'),
                time: scheduleTime,
                location: scheduleLocation
            } : undefined,
             surveyDetails: (selectedProject.status === 'Pending Survey Details' || selectedProject.status === 'Survey Scheduled') && (actionTaken === 'submitted' || actionTaken === 'reschedule_survey') ? {
                date: (actionTaken === 'reschedule_survey' && rescheduleDate) ? format(rescheduleDate, 'yyyy-MM-dd') : (surveyDate ? format(surveyDate, 'yyyy-MM-dd') : ''),
                time: (actionTaken === 'reschedule_survey') ? rescheduleTime : surveyTime,
                description: surveyDescription
            } : undefined,
        };

        const response = await fetch(`${API_BASE_URL}/api/projects/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
        });

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.message);
        }
        
        toast({ title: projectsDict.toast.progressSubmitted, description: "Project has been updated successfully." });

        // Reset form states
        setDescription('');
        setUploadedFiles([]);
        if (actionTaken.includes('revise')) { setRevisionNote(''); }
        if (isArchitectInitialImageUpload) {
            setInitialImageFiles([]);
            setInitialImageDescription('');
            setIsInitialImageUploadDialogOpen(false);
        }
        if (uploadDialogState.isOpen) {
          setUploadDialogState({ isOpen: false, item: null, division: null });
        }


      } catch (error: any) {
         console.error("Error updating project:", error);
         if (!hadError) {
            toast({ variant: 'destructive', title: projectsDict.toast.updateError, description: error.message || projectsDict.toast.failedToSubmitProgress });
         }
      } finally {
        // This block runs regardless of success or failure
        if (selectedProject) {
            newlyUpdatedProject = await fetchProjectById(selectedProject.id);
            if (newlyUpdatedProject) {
                setAllProjects(prev => prev.map(p => p.id === newlyUpdatedProject!.id ? newlyUpdatedProject! : p));
                setSelectedProject(newlyUpdatedProject); 
            }
        }
        setIsSubmitting(false);
        if (isArchitectInitialImageUpload) setIsSubmittingInitialImages(false);
      }
  }, [currentUser, selectedProject, uploadedFiles, description, scheduleDate, scheduleTime, scheduleLocation, surveyDate, surveyTime, surveyDescription, projectsDict, toast, actingRole, uploadDialogState.isOpen, rescheduleDate, rescheduleTime, fetchProjectById]);

  const handleAdminFileUpload = async () => {
    if (!currentUser || !Array.isArray(currentUser.roles) || !selectedProject || adminFiles.length === 0) {
        return;
    }

    setIsUploadingAdminFiles(true);
    try {
        for (const file of adminFiles) {
            const formDataPayload = {
              projectId: selectedProject.id,
              userId: currentUser.id,
              uploaderRole: currentUser.roles[0],
              note: adminFileNote,
              associatedChecklistItem: null,
            };
            await uploadFileWithFormData(file, formDataPayload);
        }
        
        const newlyUpdatedProject = await fetchProjectById(selectedProject.id);
        if (newlyUpdatedProject) {
            setAllProjects(prev => prev.map(p => (p.id === newlyUpdatedProject.id ? newlyUpdatedProject : p)));
            setSelectedProject(newlyUpdatedProject);
        }

        toast({ title: "File Berhasil Diunggah", description: `${adminFiles.length} file administrasi telah ditambahkan ke proyek.` });
        setAdminFiles([]);
        setAdminFileNote('');

    } catch (error: any) {
        console.error("Error uploading administrative files:", error);
        toast({ variant: 'destructive', title: "Gagal Mengunggah File", description: error.message });
    } finally {
        setIsUploadingAdminFiles(false);
    }
  };
  
  const handleSurveyScheduleSubmit = React.useCallback(async () => {
        if (!currentUser || !Array.isArray(currentUser.roles) || !selectedProject ) { 
            toast({ variant: 'destructive', title: projectsDict.toast.permissionDenied, description: projectsDict.toast.notYourTurn });
            return;
        }
        const canSubmitSurvey = selectedProject.status === 'Pending Survey Details' &&
                            (
                                currentUser.roles.includes('Arsitek') ||
                                currentUser.roles.includes('Owner')
                            );

        if (!canSubmitSurvey) {
            toast({ variant: 'destructive', title: projectsDict.toast.permissionDenied, description: "You do not have permission to submit survey details for this project at this stage." });
            return;
        }

        if (!surveyDate || !surveyTime) {
            toast({ variant: 'destructive', title: projectsDict.toast.missingInput, description: "Please provide survey date and time." });
            return;
        }
        await handleProgressSubmit('submitted');
    }, [currentUser, selectedProject, surveyDate, surveyTime, projectsDict, toast, handleProgressSubmit]);

    const handleSurveyCompletionSubmit = React.useCallback(async () => {
        if (!currentUser || !selectedProject || selectedProject.status !== 'Survey Scheduled') {
            toast({ variant: 'destructive', title: projectsDict.toast.permissionDenied, description: projectsDict.toast.notYourTurn });
            return;
        }
        await handleProgressSubmit('submitted', uploadedFiles, description);
    }, [currentUser, selectedProject, uploadedFiles, description, handleProgressSubmit, toast, projectsDict]);

    const handleRescheduleSurveySubmit = async () => {
        if (!selectedProject || !currentUser) return;
        if (!rescheduleDate || !rescheduleTime || !rescheduleNote.trim()) {
            toast({ variant: 'destructive', title: projectsDict.toast.error, description: projectsDict.rescheduleSurveyDialog.validationError });
            return;
        }
        setIsSubmitting(true);
        await handleProgressSubmit('reschedule_survey', [], rescheduleNote);
        setIsSubmitting(false);
        setIsRescheduleDialogOpen(false);
        setRescheduleDate(undefined);
        setRescheduleTime('');
        setRescheduleNote('');
    };

  const handleRescheduleFromParallel = React.useCallback(async () => {
    if (!selectedProject || !currentUser) return;
    if (!rescheduleFromParallelNote.trim()) {
        toast({
            variant: "destructive",
            title: projectsDict.toast.error || "Error",
            description: "Alasan penjadwalan ulang wajib diisi."
        });
        return;
    }
    await handleProgressSubmit('reschedule_survey_from_parallel', [], rescheduleFromParallelNote);
    setIsRescheduleFromParallelDialogOpen(false);
    setRescheduleFromParallelNote('');
  }, [selectedProject, currentUser, rescheduleFromParallelNote, projectsDict, toast, handleProgressSubmit]);

  const handleDecision = React.useCallback((decision: 'approved' | 'rejected' | 'completed' | 'revise_offer' | 'revise_dp' | 'canceled_after_sidang' | 'revision_completed_proceed_to_invoice' | 'mark_division_complete' | 'reschedule_sidang') => {
    if (!currentUser || !Array.isArray(currentUser.roles) || !selectedProject ) {
      toast({ variant: 'destructive', title: projectsDict.toast.permissionDenied, description: projectsDict.toast.notYourTurn });
      return;
    }
    const isOwnerAction = ['approved', 'rejected', 'revise_offer', 'revise_dp', 'canceled_after_sidang', 'reschedule_sidang'].includes(decision);
    if (isOwnerAction && !currentUser.roles.includes('Owner')) {
        toast({ variant: 'destructive', title: projectsDict.toast.permissionDenied, description: projectsDict.toast.onlyOwnerDecision });
        return;
    }
    const isPostSidangAdminAction = decision === 'revision_completed_proceed_to_invoice';
     if (isPostSidangAdminAction && !currentUser.roles.includes('Admin Proyek')) {
        toast({ variant: 'destructive', title: projectsDict.toast.permissionDenied, description: "Only Admin Proyek can complete post-sidang revisions." });
        return;
    }

    if (decision === 'completed' && selectedProject.status === 'Pending Final Documents' && !currentUser.roles.some(r => ['Admin Proyek', 'Owner'].includes(r))) {
        toast({ variant: 'destructive', title: projectsDict.toast.permissionDenied, description: "Only Admin Proyek or Owner can complete the project at this stage." });
        return;
    }


    handleProgressSubmit(decision);
  }, [currentUser, selectedProject, projectsDict, toast, handleProgressSubmit]);

  const handlePostSidangRevisionSubmit = async () => {
    if (!postSidangRevisionNote.trim()) {
      toast({ variant: 'destructive', title: projectsDict.toast.error, description: projectsDict.toast.revisionNoteRequired || "A revision note is required." });
      return;
    }
    await handleProgressSubmit('revise_after_sidang', postSidangRevisionFiles, postSidangRevisionNote);
    setIsPostSidangRevisionDialogOpen(false);
    setPostSidangRevisionNote('');
    setPostSidangRevisionFiles([]);
  };

  const handleScheduleSubmit = React.useCallback(() => {
    if (!currentUser || !Array.isArray(currentUser.roles) || !selectedProject) {
        toast({ variant: 'destructive', title: projectsDict.toast.permissionDenied, description: projectsDict.toast.schedulingPermissionDenied });
        return;
    }
    const canSchedule = selectedProject.status === 'Pending Scheduling' &&
                        ( (currentUser.roles.includes('Admin Proyek') && canPerformSelectedProjectAction) ||
                          currentUser.roles.includes('Owner') );

     if (!canSchedule) {
        toast({ variant: 'destructive', title: projectsDict.toast.permissionDenied, description: projectsDict.toast.schedulingPermissionDenied });
        return;
     }

     if (!scheduleDate || !scheduleTime || !scheduleLocation.trim()) {
         toast({ variant: 'destructive', title: projectsDict.toast.missingScheduleInfo, description: projectsDict.toast.provideDateTimeLoc });
         return;
     }
     handleProgressSubmit('scheduled');
  }, [currentUser, selectedProject, scheduleDate, scheduleTime, scheduleLocation, projectsDict, toast, handleProgressSubmit, canPerformSelectedProjectAction]);

    const handleAddToCalendar = React.useCallback(async () => {
      if (!selectedProject || selectedProject.status !== 'Scheduled' || !currentUser) {
        toast({ variant: 'destructive', title: projectsDict.toast.cannotAddCalendarYet, description: projectsDict.toast.mustScheduleFirst });
        return;
      }

      if (!currentUser.id) {
        toast({ variant: 'destructive', title: projectsDict.toast.calendarError, description: "User ID is missing." });
        return;
      }

      if (!currentUser.googleRefreshToken) {
        toast({
            variant: 'destructive',
            title: settingsDict.googleCalendarError,
            description: settingsDict.googleCalendarConnectDesc,
            action: (
                <ToastAction
                    altText={settingsDict.title}
                    onClick={() => router.push('/dashboard/settings')}
                >
                    {settingsDict.title}
                </ToastAction>
            ),
        });
        return;
      }

      if (!selectedProject.scheduleDetails || !selectedProject.scheduleDetails.date || !selectedProject.scheduleDetails.time) {
        toast({ variant: 'destructive', title: projectsDict.toast.errorFindingSchedule, description: projectsDict.toast.couldNotFindSchedule });
        return;
      }

      const scheduledDateTime = new Date(`${selectedProject.scheduleDetails.date}T${selectedProject.scheduleDetails.time}`);
      const endTime = new Date(scheduledDateTime.getTime() + 60 * 60 * 1000);

      const eventDetails = {
        title: `${projectsDict.sidangEventTitlePrefix}: ${selectedProject.title}`,
        location: selectedProject.scheduleDetails.location,
        startTime: scheduledDateTime.toISOString(),
        endTime: endTime.toISOString(),
        description: `${projectsDict.sidangEventDescPrefix}: ${selectedProject.title}`
      };

      try {
        setIsAddingToCalendar(true);
        const response = await fetch(`${API_BASE_URL}/api/calendar/create-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, eventDetails }),
        });

        let errorDetails = projectsDict.toast.couldNotAddEvent;
        let responseText = "";
        if (!response.ok) {
            try {
                responseText = await response.text();
                if (responseText.trim().startsWith('{') && responseText.trim().endsWith('}')) {
                    const errorPayload = JSON.parse(responseText);
                    errorDetails = errorPayload?.details || errorPayload?.error || errorDetails;
                } else {
                    errorDetails = responseText || errorDetails;
                }
            } catch (e) {
                 console.error("Server returned non-JSON error response for calendar event or failed to parse JSON:", response.status, responseText, e);
                 errorDetails = responseText.substring(0,100) || `Server: ${response.status}`;
            }
            throw new Error(errorDetails);
        }
        const result = await response.json();
        toast({ title: projectsDict.toast.addedToCalendar, description: projectsDict.toast.eventId.replace('{id}', result.eventId || 'N/A') });
      } catch (error: any) {
        console.error("Error scheduling event:", error);
        const descriptionText = (error && typeof error.message === 'string' && error.message.trim() !== "")
                            ? error.message
                            : projectsDict.toast.couldNotAddEvent;
        toast({
            variant: 'destructive',
            title: projectsDict.toast.calendarError,
            description: descriptionText
        });
      } finally {
        setIsAddingToCalendar(false);
      }
    }, [selectedProject, currentUser, projectsDict, toast, router, settingsDict]);

    const roleFilteredProjects = React.useMemo(() => {
        if (!currentUser || !Array.isArray(currentUser.roles)) return [];
        const adminRoles = ['Owner', 'Akuntan', 'Admin Proyek', 'Admin Developer'];
        const isUserAdminLike = currentUser.roles.some(role => adminRoles.includes(role));

        if (isUserAdminLike) {
            return allProjects;
        }

        return allProjects.filter(project => {
            if (project.status === 'Pending Parallel Design Uploads' || project.status === 'Pending Post-Sidang Revision') {
                return currentUser.roles.some(role => ['Arsitek', 'Struktur', 'MEP'].includes(role));
            }
            const assignedDivisionCleaned = project.assignedDivision?.trim();
            return currentUser.roles.some(role => role === assignedDivisionCleaned);
        });
    }, [currentUser, allProjects]);

    React.useEffect(() => {
        let currentProjects = roleFilteredProjects;
        if (statusFilter.length > 0) {
            currentProjects = currentProjects.filter(project => statusFilter.includes(project.status));
        }
        if (searchTerm.trim() !== '') {
            currentProjects = currentProjects.filter(project =>
                project.title.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        setDisplayedProjects(currentProjects);
    }, [searchTerm, statusFilter, roleFilteredProjects]);

    const handleStatusFilterChange = (status: string) => {
        setStatusFilter(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
    };

   const canDownloadFiles = React.useMemo(() => currentUser && Array.isArray(currentUser.roles) && currentUser.roles.some(r => ['Owner', 'Akuntan', 'Admin Proyek', 'Arsitek', 'Struktur', 'MEP', 'Admin Developer'].includes(r)), [currentUser]);

   const handleDownloadFile = React.useCallback(async (file: FileEntry) => {
        setIsDownloading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/download-file?filePath=${encodeURIComponent(file.path)}`);
            if (!response.ok) {
                let errorDetails = `Failed to download ${file.name}. Status: ${response.status}`;
                let responseText = "";
                try {
                    responseText = await response.text();
                    if (responseText.trim().startsWith('{') && responseText.trim().endsWith('}')) {
                        const errorData = JSON.parse(responseText);
                        errorDetails = errorData.message || errorData.error || errorDetails;
                    } else {
                        errorDetails = responseText.substring(0,200) || errorDetails;
                    }
                } catch (e) {
                     console.warn("Could not parse error response for file download, or response text was empty. Raw response text (if available):", responseText);
                     errorDetails = responseText || `Failed to download ${file.name}. Status: ${response.status}`;
                }
                throw new Error(errorDetails);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast({ title: projectsDict.toast.downloadStarted, description: `${projectsDict.toast.downloadSuccessDesc.replace('{filename}', file.name)}`});
        } catch (error: any) {
            console.error("Error downloading file:", error);
            toast({ variant: 'destructive', title: projectsDict.toast.error, description: error.message || projectsDict.toast.downloadErrorDesc });
        } finally {
            setIsDownloading(false);
        }
    }, [toast, projectsDict]);

    const handleDeleteFile = React.useCallback(async (filePath: string, fileName: string) => {
        if (!selectedProject || !currentUser) return;

        setIsDeletingFile(filePath);
        try {
            const response = await fetch(`${API_BASE_URL}/api/delete-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: selectedProject.id,
                    filePath,
                    userId: currentUser.id
                })
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || projectsDict.toast.fileDeleteError);
            }

            const updatedProject = await fetchProjectById(selectedProject.id);
            if (updatedProject) {
                setAllProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
                setSelectedProject(updatedProject);
            }

            toast({
                title: projectsDict.toast.fileDeletedTitle,
                description: projectsDict.toast.fileDeletedDesc.replace('{filename}', fileName),
            });

        } catch (error: any) {
            toast({ variant: 'destructive', title: projectsDict.toast.error, description: error.message });
        } finally {
            setIsDeletingFile(null);
        }
    }, [selectedProject, currentUser, projectsDict.toast, toast, fetchProjectById]);

    const handleReviseSubmit = React.useCallback(async () => {
      if (!currentUser || !Array.isArray(currentUser.roles) || !selectedProject) {
        toast({ variant: 'destructive', title: projectsDict.toast.permissionDenied, description: projectsDict.toast.revisionPermissionDenied });
        return;
      }
      
      let actionForRevision = 'revise';
      if (currentUser.roles.includes('Owner') && selectedProject.status === 'Pending Approval' && selectedProject.progress === 20) {
        actionForRevision = 'revise_offer';
      } else if (currentUser.roles.includes('Owner') && selectedProject.status === 'Pending Approval' && selectedProject.progress === 30) {
        actionForRevision = 'revise_dp';
      }

      if (!revisionNote.trim()) {
        toast({ variant: 'destructive', title: projectsDict.toast.revisionError, description: projectsDict.toast.revisionNoteRequired });
        return;
      }

      setIsRevising(true);
      setIsGenericRevisionDialogOpen(false);

      try {
        const response = await fetch(`${API_BASE_URL}/api/projects/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            specialAction: 'revise',
            projectId: selectedProject.id,
            updaterUsername: currentUser.username,
            updaterRoles: currentUser.roles,
            note: revisionNote,
            actionTaken: actionForRevision,
          }),
        });
        
        const revisedProjectResult = await response.json();
        if (!response.ok) throw new Error(revisedProjectResult.message);
        
        const updatedProject = await fetchProjectById(selectedProject.id); 
        if (updatedProject) {
            setAllProjects(prev => prev.map(p => (p.id === updatedProject.id ? updatedProject : p)));
            setSelectedProject(updatedProject); 
        }
        
        if (revisedProjectResult) {
          setRevisionNote('');
          toast({ title: projectsDict.toast.revisionSuccess, description: projectsDict.toast.revisionSuccessDesc.replace('{division}', getTranslatedStatus(revisedProjectResult.assignedDivision)) });
        }
      } catch (error: any) {
        console.error("Error revising project:", error);
        let desc = projectsDict.toast.failedToRevise;
        if (error.message.includes('REVISION_NOT_SUPPORTED')) {
          desc = projectsDict.toast.revisionNotApplicable;
        } else {
          desc = error.message || desc;
        }
        toast({ variant: 'destructive', title: projectsDict.toast.revisionError, description: desc });
      } finally {
        setIsRevising(false);
      }
    }, [currentUser, selectedProject, revisionNote, projectsDict, toast, getTranslatedStatus, fetchProjectById]);

    const showUploadSection = React.useMemo(() => {
        if (!selectedProject || !currentUser || !Array.isArray(currentUser.roles) || !actingRole) {
            return false;
        }

        if (currentUser.roles.includes('Owner')) {
            return false;
        }
        
        if (!selectedProject.assignedDivision) return false;

        const canTakeAction = currentUser.roles.includes(selectedProject.assignedDivision.trim());
        if (!canTakeAction) return false;

        const statusesExpectingUpload = [
            'Pending Offer', 'Pending DP Invoice', 'Pending Admin Files',
            'Pending Architect Files', 'Pending Structure Files', 'Pending MEP Files',
            'Pending Consultation Docs', 'Pending Pelunasan Invoice', 'Pending Sidang Registration Proof'
        ];

        return statusesExpectingUpload.includes(selectedProject.status);
    }, [selectedProject, currentUser, actingRole]);

    const showSharedDesignChecklistSection = React.useMemo(() => {
        if (!selectedProject || !currentUser || !Array.isArray(currentUser.roles)) return false;
        const isParallelStatus = selectedProject.workflowId === 'msa_workflow' &&
                               selectedProject.status === 'Pending Parallel Design Uploads';
        const isRevisionStatus = selectedProject.status === 'Pending Post-Sidang Revision';
        const isAuthorizedRole = currentUser.roles.some(r => ['Admin Proyek', 'Owner', 'Admin Developer', 'Arsitek', 'Struktur', 'MEP'].includes(r));
        return (isParallelStatus || isRevisionStatus) && isAuthorizedRole;
    }, [selectedProject, currentUser]);

    const showDivisionalChecklist = React.useMemo(() => {
        if (!selectedProject || !currentUser || !Array.isArray(currentUser.roles) || !parallelUploadChecklist) return false;
        const isDesignRole = currentUser.roles.some(r => ['Arsitek', 'Struktur', 'MEP'].includes(r));
        const isParallelOrRevisionStatus =
            selectedProject.status === 'Pending Parallel Design Uploads' ||
            selectedProject.status === 'Pending Post-Sidang Revision';
        
        return isDesignRole && isParallelOrRevisionStatus;
    }, [selectedProject, currentUser, parallelUploadChecklist]);
    
   const showArchitectInitialImageUploadSection = React.useMemo(() => {
    return selectedProject &&
           currentUser && Array.isArray(currentUser.roles) &&
           selectedProject.status === 'Pending Architect Files' &&
           currentUser.roles.includes('Arsitek') &&
           canPerformSelectedProjectAction;
    }, [selectedProject, currentUser, canPerformSelectedProjectAction]);

   const showOwnerDecisionSection = React.useMemo(() => {
    if (!selectedProject || !currentUser || !Array.isArray(currentUser.roles)) return false;
    
    if (!currentUser.roles.includes('Owner') || !canPerformSelectedProjectAction) {
        return false;
    }
    
    const isOfferApproval = selectedProject.status === 'Pending Approval' && selectedProject.progress === 20;
    const isDPInvoiceApproval = selectedProject.status === 'Pending Approval' && selectedProject.progress === 30;
    
    return isOfferApproval || isDPInvoiceApproval;
},[selectedProject, currentUser, canPerformSelectedProjectAction]);

   const showSchedulingSection = React.useMemo(() => {
        if (!selectedProject || !currentUser || !Array.isArray(currentUser.roles)) return false;
        return selectedProject.status === 'Pending Scheduling' &&
               (
                  (currentUser.roles.includes('Admin Proyek') && canPerformSelectedProjectAction) ||
                  currentUser.roles.includes('Owner')
               );
    },[selectedProject, currentUser, canPerformSelectedProjectAction]);

    const showSurveyDetailsInputSection = React.useMemo(() => {
      if (!selectedProject || !currentUser || !Array.isArray(currentUser.roles)) return false;
      const canTakeAction = currentUser.roles.some(r => ['Arsitek', 'Owner'].includes(r));
      return selectedProject.status === 'Pending Survey Details' && canTakeAction;
    }, [selectedProject, currentUser]);

    const showSurveyCompletionSection = React.useMemo(() => {
        if (!selectedProject || !currentUser || !Array.isArray(currentUser.roles)) return false;
        const canTakeAction = currentUser.roles.includes('Arsitek');
        const isCorrectStatus = selectedProject.status === 'Survey Scheduled';
        return isCorrectStatus && canTakeAction;
    }, [selectedProject, currentUser]);
    
    const showAdminFileUploadSection = React.useMemo(() => {
        if (!selectedProject || !currentUser || !Array.isArray(currentUser.roles)) return false;
        const canTakeAction = currentUser.roles.includes('Admin Proyek');
        const isProjectActive = !['Completed', 'Canceled'].includes(selectedProject.status);
        
        // Check if the "Pending Admin Files" step has been passed
        const hasCompletedAdminFilesStep = selectedProject.workflowHistory.some(h => 
            h.action.toLowerCase().includes('berkas administrasi')
        );

        return isProjectActive && canTakeAction && hasCompletedAdminFilesStep && selectedProject.status !== 'Pending Admin Files';
    }, [selectedProject, currentUser]);


   const showCalendarButton = React.useMemo(() =>
        selectedProject &&
        selectedProject.status === 'Scheduled' &&
        currentUser && Array.isArray(currentUser.roles) &&
        currentUser.roles.some(r => ['Owner', 'Admin Proyek'].includes(r)),
    [selectedProject, currentUser]);

    const showSidangOutcomeSection = React.useMemo(() => {
      if (!selectedProject || !currentUser || !Array.isArray(currentUser.roles)) return false;
      const canTakeAction = canPerformSelectedProjectAction && currentUser.roles.some(r => ['Owner', 'Admin Proyek'].includes(r));
      return selectedProject.status === 'Scheduled' && canTakeAction;
    }, [selectedProject, currentUser, canPerformSelectedProjectAction]);

    const showPostSidangRevisionSection = React.useMemo(() => {
        if (!selectedProject || !currentUser || !Array.isArray(currentUser.roles)) return false;
        const isAdminRole = currentUser.roles.some(r => ['Admin Proyek', 'Owner', 'Admin Developer'].includes(r));
        return selectedProject.status === 'Pending Post-Sidang Revision' && isAdminRole;
    }, [selectedProject, currentUser]);

    const handleDivisionCompletion = React.useCallback(async () => {
        if (!selectedProject || !currentUser || !Array.isArray(currentUser.roles)) return;
        setIsSubmitting(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/projects/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    specialAction: 'markDivisionComplete',
                    projectId: selectedProject.id,
                    updaterRoles: currentUser.roles,
                    updaterUsername: currentUser.username,
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message);
            }
            
            const updatedProject = await fetchProjectById(selectedProject.id);
            if (updatedProject) {
                setAllProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
                setSelectedProject(updatedProject);
            }
            toast({ title: projectsDict.toast.divisionCompletionTitle, description: projectsDict.toast.divisionCompletionDesc.replace('{role}', getTranslatedStatus(currentUser.roles[0])) });
        } catch (error: any) {
            console.error(`Error marking division as complete for project ${selectedProject.id}:`, error);
            toast({ variant: 'destructive', title: projectsDict.toast.error, description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedProject, currentUser, toast, projectsDict, getTranslatedStatus, fetchProjectById]);

    const handleNotifyDivision = async (division: 'Arsitek' | 'Struktur' | 'MEP') => {
        if (!selectedProject || !currentUser) return;
        setIsSubmitting(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/notify-division`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: selectedProject.id,
                    projectName: selectedProject.title,
                    actorUserId: currentUser.id,
                    divisionToNotify: division,
                }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || `Gagal mengirim notifikasi ke ${division}.`);
            }
            toast({
                title: projectsDict.toast.revisionNotificationSentTitle,
                description: projectsDict.toast.revisionNotificationSentDesc
                    .replace('{division}', getTranslatedStatus(division))
                    .replace('{projectName}', selectedProject.title)
                    .replace('{actorUsername}', currentUser.username),
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: projectsDict.toast.error,
                description: error.message,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const allChecklistItemsUploaded = React.useMemo(() => {
        if (!parallelUploadChecklist) return false;
        return Object.values(parallelUploadChecklist).every(divisionItems =>
            divisionItems?.every(item => item.uploaded)
        );
    }, [parallelUploadChecklist]);

    const translateHistoryAction = React.useCallback((action: string): string => {
        if (!action) return action || '';

        const translations = projectsDict.workflowActions;
        if (!translations) return action;

        const createdMatch = action.match(/^(Created Project with workflow|Proyek dibuat dengan alur kerja): (.*)$/i);
        if (createdMatch) {
            return (translations.createdProjectWithWorkflow || "Created Project with workflow: {workflowId}")
                .replace('{workflowId}', createdMatch[2]);
        }

        const assignedMatch = action.match(/^(Assigned to|Ditugaskan kepada) (.*?) for (.*)$/i);
        if (assignedMatch) {
            const division = getTranslatedStatus(assignedMatch[2]);
            const nextAction = assignedMatch[3];
            return (translations.assignedToFor || "Assigned to {division} for {nextAction}")
                .replace('{division}', division)
                .replace('{nextAction}', nextAction);
        }
        
        const uploadedFileMatch = action.match(/^(Uploaded initial file|Mengunggah file awal): (.*)$/i);
        if (uploadedFileMatch) {
            return (translations.uploadedInitialFile || "Uploaded initial file: {fileName}")
                .replace('{fileName}', uploadedFileMatch[2]);
        }

        const submittedMatch = action.match(/^(.*?) \((.*?)\) (submitted for|menyerahkan untuk) "(.*)"$/i);
        if (submittedMatch) {
            return (translations.submittedFor || "{username} ({role}) submitted for \"{task}\"")
                .replace('{username}', submittedMatch[1])
                .replace('{role}', getTranslatedStatus(submittedMatch[2]))
                .replace('{task}', submittedMatch[4]);
        }
        
        const approvedMatch = action.match(/^(.*?) \((.*?)\) (approved|menyetujui): (.*)$/i);
        if (approvedMatch) {
            return (translations.approvedAction || "{username} ({role}) approved: {task}")
                .replace('{username}', approvedMatch[1])
                .replace('{role}', getTranslatedStatus(approvedMatch[2]))
                .replace('{task}', approvedMatch[4]);
        }

        return action;
    }, [projectsDict.workflowActions, getTranslatedStatus]);

    const groupedAndSortedHistory = React.useMemo(() => {
        if (!selectedProject) return [];
        const grouped = new Map<string, GroupedHistoryItem>();

        (selectedProject.workflowHistory || []).forEach(entry => {
            if (!grouped.has(entry.timestamp)) {
                grouped.set(entry.timestamp, { timestamp: entry.timestamp, entries: [], files: [] });
            }
            grouped.get(entry.timestamp)!.entries.push(entry);
        });

        (selectedProject.files || []).forEach(file => {
            if (!grouped.has(file.timestamp)) {
                grouped.set(file.timestamp, { timestamp: file.timestamp, entries: [], files: [] });
            }
            grouped.get(file.timestamp)!.files.push(file);
        });
        
        return Array.from(grouped.values())
            .filter(group => group.entries.length > 0 || group.files.length > 0)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    }, [selectedProject]);

    const finalDocsChecklistStatus = React.useMemo(() => {
        if (selectedProject?.status !== 'Pending Final Documents') return null;
        const projectFiles = selectedProject.files || [];
        
        const hasGeneralFinalDoc = projectFiles.some(file => 
            file.uploadedBy === 'Admin Proyek' && 
            file.name.toLowerCase().includes('dokumen_final')
        );

        return finalDocRequirements.map(reqName => {
            const reqKeywords = reqName.toLowerCase().split(' ').filter(k => k);
            
            // Special handling for the first item "Dokumen Final"
            if (reqName === 'Dokumen Final' && hasGeneralFinalDoc) {
                const uploadedFile = projectFiles.find(file => file.name.toLowerCase().includes('dokumen_final'));
                return {
                    name: reqName,
                    uploaded: true,
                    filePath: uploadedFile?.path,
                    originalFileName: uploadedFile?.name,
                    uploadedBy: uploadedFile?.uploadedBy
                };
            }

            const uploadedFile = projectFiles.find(file => {
                const fileNameLower = file.name.toLowerCase();
                const allKeywordsMatch = reqKeywords.every(keyword => fileNameLower.includes(keyword));
                
                if (reqName === 'Bukti Pembayaran' || reqName === 'Pelunasan') {
                    return allKeywordsMatch && (file.uploadedBy === 'Owner' || file.uploadedBy === 'Akuntan' || file.uploadedBy === 'Admin Proyek');
                }
                
                return allKeywordsMatch && file.uploadedBy === 'Admin Proyek';
            });

            return { 
                name: reqName, 
                uploaded: !!uploadedFile, 
                filePath: uploadedFile?.path, 
                originalFileName: uploadedFile?.name, 
                uploadedBy: uploadedFile?.uploadedBy 
            };
        });
    }, [selectedProject]);
    

    const allFinalDocsUploaded = React.useMemo(() => {
        if (!finalDocsChecklistStatus) return false;
        return finalDocsChecklistStatus.every(item => item.uploaded);
    }, [finalDocsChecklistStatus]);

    const showFinalDocumentUploadSection = React.useMemo(() => {
      if (!selectedProject || !currentUser || !Array.isArray(currentUser.roles)) return false;
      const canTakeAction = currentUser.roles.includes('Admin Proyek') || currentUser.roles.includes('Owner') || currentUser.roles.includes('Akuntan');
      return selectedProject.status === 'Pending Final Documents' && canTakeAction;
    }, [selectedProject, currentUser]);

  if (!isClient) {
    return (
        <div className="container mx-auto py-4 px-4 md:px-6 space-y-6">
            <Card className="shadow-md animate-pulse">
                <CardHeader className="p-4 sm:p-6"><Skeleton className="h-7 w-3/5 mb-2" /><Skeleton className="h-4 w-4/5" /></CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                    <div className="flex justify-end mb-4"><Skeleton className="h-10 w-32" /></div>
                    <div className="space-y-4">{[...Array(3)].map((_, i) => (<Card key={`project-skel-${i}`} className="opacity-50 border-muted/50"><CardHeader className="flex flex-col sm:flex-row items-start justify-between space-y-2 sm:space-y-0 pb-2 p-4 sm:p-6"><div><Skeleton className="h-5 w-3/5 mb-1" /><Skeleton className="h-3 w-4/5" /></div><div className="flex-shrink-0 mt-2 sm:mt-0"><Skeleton className="h-5 w-20 rounded-full" /></div></CardHeader><CardContent className="p-4 sm:p-6 pt-0"><div className="flex items-center gap-2"><Skeleton className="flex-1 h-2" /><Skeleton className="h-3 w-1/4" /></div></CardContent></Card>))}</div>
                </CardContent>
            </Card>
        </div>
    );
  }

  const renderProjectList = () => {
       if (!projectsDict?.projectListTitle) {
        return (<div className="container mx-auto py-4 px-4 md:px-6 space-y-6"><Card><CardHeader className="p-4 sm:p-6"><Skeleton className="h-7 w-3/5 mb-2" /></CardHeader></Card></div>);
    }
    return (
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
                    <Input
                        type="search"
                        placeholder={projectsDict.searchPlaceholder}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 w-full sm:w-[200px] md:w-[250px]"
                    />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="outline" className="w-full sm:w-auto"><ListFilter className="mr-2 h-4 w-4" /><span className="truncate">{projectsDict.filterButton}</span>{statusFilter.length > 0 && ` (${statusFilter.length})`}</Button></DropdownMenuTrigger>
                   <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>{projectsDict.filterStatusLabel}</DropdownMenuLabel><DropdownMenuSeparator />
                    {projectStatuses.map((status) => (<DropdownMenuCheckboxItem key={status} checked={statusFilter.includes(status)} onCheckedChange={() => handleStatusFilterChange(status)}>{getTranslatedStatus(status)}</DropdownMenuCheckboxItem>))}
                    <DropdownMenuSeparator /><DropdownMenuCheckboxItem checked={statusFilter.length === 0} onCheckedChange={() => setStatusFilter([])} className="text-muted-foreground">{projectsDict.filterClear}</DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="space-y-4">
            {isLoadingProjects && displayedProjects.length === 0 ? (
                [...Array(3)].map((_, i) => (
                    <Card key={`project-list-skel-${i}`} className="opacity-50 border-muted/50 animate-pulse">
                        <CardHeader className="flex flex-col sm:flex-row items-start justify-between space-y-2 sm:space-y-0 pb-2 p-4 sm:p-6">
                            <div className="flex-1 min-w-0"><Skeleton className="h-5 w-3/5 mb-1" /><Skeleton className="h-3 w-4/5" /></div>
                            <div className="flex-shrink-0 mt-2 sm:mt-0"><Skeleton className="h-5 w-20 rounded-full" /></div>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 pt-0"><div className="flex items-center gap-2"><Skeleton className="flex-1 h-2" /><Skeleton className="h-3 w-1/4" /></div></CardContent>
                    </Card>
                ))
            ) : displayedProjects.length === 0 ? (<p className="text-muted-foreground text-center py-4">{searchTerm ? projectsDict.noSearchResults : projectsDict.noProjectsFound}</p>) : (
              displayedProjects.map((projectItem) => (
                <Card key={projectItem.id} className="hover:shadow-lg transform hover:-translate-y-1 transition-all duration-200 cursor-pointer" onClick={() => {setSelectedProject(projectItem); router.push(`/dashboard/projects?projectId=${projectItem.id}`, { scroll: false }); }}>
                   <CardHeader className="flex flex-col items-start gap-2 sm:flex-row sm:items-start sm:justify-between p-4 pb-2">
                        <div className="flex-1 min-w-0">
                            <CardTitle className="text-base sm:text-lg">{projectItem.title}</CardTitle>
                            <CardDescription className="text-xs text-muted-foreground mt-1">
                                {projectsDict.assignedLabel}: {getTranslatedStatus(projectItem.assignedDivision) || projectsDict.none} | {projectsDict.nextActionLabel}: {projectItem.nextAction || projectsDict.none}
                            </CardDescription>
                        </div>
                        <div className="flex-shrink-0 pt-2 sm:pt-0">
                            {getStatusBadge(projectItem.status)}
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                        {projectItem.status !== 'Canceled' && projectItem.status !== 'Completed' && (
                            <div className="flex items-center gap-2">
                                <Progress value={projectItem.progress} className="w-full h-2" />
                                <span className="text-xs text-muted-foreground font-medium">{projectItem.progress}%</span>
                            </div>
                        )}
                        {(projectItem.status === 'Canceled' || projectItem.status === 'Completed') && (
                            <p className={`text-sm font-medium ${projectItem.status === 'Canceled' ? 'text-destructive' : 'text-green-600'}`}>
                                {getTranslatedStatus(projectItem.status)}
                            </p>
                        )}
                    </CardContent>
                    <CardFooter className="text-xs text-muted-foreground justify-end p-4 pt-0">
                        <span className="flex items-center gap-1">{projectsDict.viewDetails} <ArrowRight className="h-3 w-3" /></span>
                    </CardFooter>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderSelectedProjectDetail = (project: Project) => {
       if (!projectsDict?.backToList || !project) return (
            <div className="container mx-auto py-4 px-4 md:px-6 space-y-6">
                <Button variant="outline" onClick={() => {setSelectedProject(null); router.push('/dashboard/projects', { scroll: false });}} className="mb-4 w-full sm:w-auto"><ArrowLeft className="mr-2 h-4 w-4" />{projectsDict.backToList}</Button>
                <Card className="shadow-md animate-pulse">
                    <CardHeader className="p-4 sm:p-6"> <Skeleton className="h-8 w-3/4 mb-2" /><Skeleton className="h-4 w-full" /></CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0"><Skeleton className="h-64 w-full" /></CardContent>
                </Card>
            </div>
       );
       
       const surveyDateObj = project.surveyDetails?.date ? parseISO(project.surveyDetails.date) : null;
       const isSurveyDatePassed = surveyDateObj && new Date() >= surveyDateObj;


       const renderChecklistItem = (item: ChecklistItem, division: string) => {
          const canAdminDelete = currentUser?.roles.includes('Admin Proyek') || currentUser?.roles.includes('Owner') || currentUser?.roles.includes('Admin Developer');
          const canUploaderDelete = currentUser?.roles.includes(item.uploadedBy || '');
          const canCurrentUserDelete = canAdminDelete || canUploaderDelete;
          const displayName = item.originalFileName || item.name;

          return (
            <li key={`${division}-${item.name}`} className="flex items-center text-sm p-2 border rounded-md hover:bg-secondary/50 gap-2">
                {item.uploaded ? <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" /> : <CircleIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={cn("truncate", item.uploaded ? "text-foreground" : "text-muted-foreground")}>{displayName}</span>
                </div>
                
                {item.uploaded && item.filePath && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => handleDownloadFile({ name: item.originalFileName!, path: item.filePath!, uploadedBy: '', timestamp: '' })} disabled={isDownloading || !!isDeletingFile} title={projectsDict.downloadFileTooltip} className="h-7 w-7">
                            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-primary" />}
                        </Button>
                        {canCurrentUserDelete && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" disabled={isDownloading || !!isDeletingFile} title={projectsDict.toast.deleteFileTooltip} className="h-7 w-7">
                                        {isDeletingFile === item.filePath ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>{projectsDict.toast.confirmFileDeleteTitle}</AlertDialogTitle>
                                        <AlertDialogDescription>{projectsDict.toast.confirmFileDeleteDesc.replace('{filename}', displayName)}</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={!!isDeletingFile}>{projectsDict.cancelButton}</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteFile(item.filePath!, displayName)} className="bg-destructive hover:bg-destructive/90" disabled={!!isDeletingFile}>
                                            {isDeletingFile === item.filePath && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            {projectsDict.toast.deleteFileConfirmButton}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                )}

                {!item.uploaded && currentUser?.roles.includes(division) && (
                    <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setUploadDialogState({ isOpen: true, item: item, division: division })} disabled={isSubmitting}>
                        <Upload className="h-3 w-3" />
                    </Button>
                )}
            </li>
          );
      };
      
       const renderFinalDocsChecklistItem = (item: ChecklistItem, index: number, allItems: ChecklistItem[]) => {
          const canAdminDelete = currentUser?.roles.includes('Admin Proyek') || currentUser?.roles.includes('Owner') || currentUser?.roles.includes('Admin Developer');
          const canUploaderDelete = currentUser?.roles.includes(item.uploadedBy || '');
          const canCurrentUserDelete = canAdminDelete || canUploaderDelete;
          const displayName = item.originalFileName || item.name;
          
          const isPaymentDoc = item.name === 'Bukti Pembayaran' || item.name === 'Pelunasan';
          
          const canAccountantUpload = isPaymentDoc && currentUser?.roles.includes('Akuntan');
          const canAdminUpload = (!isPaymentDoc && currentUser?.roles.includes('Admin Proyek')) || (isPaymentDoc && currentUser?.roles.includes('Admin Proyek'));
          const canOwnerUpload = isPaymentDoc && currentUser?.roles.includes('Owner');


          // Check if previous item is uploaded
          const isPreviousUploaded = index === 0 || allItems[index - 1].uploaded;

          return (
            <li key={`final-doc-${item.name}`} className="flex items-center text-sm p-2 border rounded-md hover:bg-secondary/50 gap-2">
                {item.uploaded ? <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" /> : <CircleIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={cn("truncate", item.uploaded ? "text-foreground" : "text-muted-foreground")}>{displayName}</span>
                </div>
                
                {item.uploaded && item.filePath && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => handleDownloadFile({ name: item.originalFileName!, path: item.filePath!, uploadedBy: '', timestamp: '' })} disabled={isDownloading || !!isDeletingFile} title={projectsDict.downloadFileTooltip} className="h-7 w-7">
                            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-primary" />}
                        </Button>
                        {canCurrentUserDelete && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" disabled={isDownloading || !!isDeletingFile} title={projectsDict.toast.deleteFileTooltip} className="h-7 w-7">
                                        {isDeletingFile === item.filePath ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>{projectsDict.toast.confirmFileDeleteTitle}</AlertDialogTitle>
                                        <AlertDialogDescription>{projectsDict.toast.confirmFileDeleteDesc.replace('{filename}', displayName)}</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={!!isDeletingFile}>{projectsDict.cancelButton}</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteFile(item.filePath!, displayName)} className="bg-destructive hover:bg-destructive/90" disabled={!!isDeletingFile}>
                                            {isDeletingFile === item.filePath && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            {projectsDict.toast.deleteFileConfirmButton}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                )}

                {!item.uploaded && (canAdminUpload || canAccountantUpload || canOwnerUpload) && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setUploadDialogState({ isOpen: true, item: item, division: canAccountantUpload ? 'Akuntan' : 'Admin Proyek' })}
                        disabled={isSubmitting || !isPreviousUploaded}
                        title={!isPreviousUploaded ? `Harus mengunggah "${allItems[index - 1].name}" terlebih dahulu` : `Unggah ${item.name}`}
                    >
                        <Upload className="h-3 w-3" />
                    </Button>
                )}
            </li>
          );
      };

       return (
           <>
                <Button variant="outline" onClick={() => {setSelectedProject(null); router.push('/dashboard/projects', { scroll: false });}} className="mb-4 w-full sm:w-auto"><ArrowLeft className="mr-2 h-4 w-4" />{projectsDict.backToList}</Button>
                
                 <Card className="shadow-md mb-6">
                   <CardHeader className="p-4 sm:p-6">
                     <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                        <div className="flex-1 min-w-0"><CardTitle className="text-xl md:text-2xl">{project.title}</CardTitle><CardDescription className="mt-1 text-xs sm:text-sm">{projectsDict.statusLabel}: {getStatusBadge(project.status)} | {projectsDict.nextActionLabel}: {project.nextAction || projectsDict.none} | {projectsDict.assignedLabel}: {getTranslatedStatus(project.assignedDivision) || projectsDict.none}</CardDescription></div>
                           <div className="text-left md:text-right w-full md:w-auto mt-2 md:mt-0">
                               <div className="text-sm font-medium">{projectsDict.progressLabel}</div>
                               <div className="flex items-center gap-2 mt-1"><Progress value={project.progress} className="w-full md:w-32 h-2" /><span className="text-xs text-muted-foreground font-medium">{project.progress}%</span></div>
                           </div>
                     </div>
                   </CardHeader>
                </Card>

                {project.status === 'Pending Parallel Design Uploads' && currentUser?.roles.includes('Admin Proyek') && (
                  <Card className="mb-6 shadow-md border-orange-500/50">
                      <CardHeader className="p-4 sm:p-6">
                          <CardTitle>Tindakan Pengawas</CardTitle>
                          <CardDescription>Opsi tambahan untuk mengelola alur proyek.</CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 sm:p-6 pt-0">
                          <Dialog open={isRescheduleFromParallelDialogOpen} onOpenChange={setIsRescheduleFromParallelDialogOpen}>
                              <DialogTrigger asChild>
                                  <Button variant="outline" disabled={isSubmitting}>
                                      <RefreshCw className="mr-2 h-4 w-4"/>
                                      Kembalikan ke Tahap Survei
                                  </Button>
                              </DialogTrigger>
                              <DialogContent>
                                  <DialogHeader>
                                      <DialogTitle>Konfirmasi Penjadwalan Ulang Survei</DialogTitle>
                                      <DialogDescription>
                                          Proyek akan dikembalikan ke tahap "Detail Survei". Masukkan alasan mengapa tindakan ini diperlukan.
                                      </DialogDescription>
                                  </DialogHeader>
                                  <div className="grid gap-4 py-4">
                                      <Label htmlFor="reschedule-parallel-note">Alasan (Wajib)</Label>
                                      <Textarea
                                          id="reschedule-parallel-note"
                                          placeholder="Contoh: Ada perubahan data awal yang memerlukan survei ulang..."
                                          value={rescheduleFromParallelNote}
                                          onChange={(e) => setRescheduleFromParallelNote(e.target.value)}
                                          disabled={isSubmitting}
                                      />
                                  </div>
                                  <DialogFooter>
                                      <Button variant="outline" onClick={() => setIsRescheduleFromParallelDialogOpen(false)} disabled={isSubmitting}>
                                          Batal
                                      </Button>
                                      <Button onClick={handleRescheduleFromParallel} disabled={isSubmitting || !rescheduleFromParallelNote.trim()}>
                                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                          Konfirmasi dan Kembalikan
                                      </Button>
                                  </DialogFooter>
                              </DialogContent>
                          </Dialog>
                      </CardContent>
                  </Card>
                )}

                 {showSharedDesignChecklistSection && parallelUploadChecklist && (
                    <Card className="mb-6 shadow-md">
                        <CardHeader className="p-4 sm:p-6">
                             <CardTitle>{project.status === 'Pending Post-Sidang Revision' ? projectsDict.revisionChecklistTitle : projectsDict.fileChecklist.title}</CardTitle>
                             <CardDescription>{project.status === 'Pending Post-Sidang Revision' ? projectsDict.revisionChecklistDesc : projectsDict.adminParallelUploadsGuidance}</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 pt-0 grid grid-cols-1 md:grid-cols-3 gap-6">
                            {(Object.entries(parallelUploadChecklist)).map(([division, items]) => (
                                <div key={division}>
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-semibold">{getTranslatedStatus(division)}</h4>
                                        {currentUser?.roles.includes(division) && (
                                             <Button 
                                                 size="sm"
                                                 variant="outline"
                                                 onClick={handleDivisionCompletion}
                                                 disabled={isSubmitting || project.parallelUploadsCompletedBy?.includes(division)}
                                                 className={cn(project.parallelUploadsCompletedBy?.includes(division) && "border-green-500 text-green-600 hover:text-green-700 hover:bg-green-50/50")}
                                             >
                                                {project.parallelUploadsCompletedBy?.includes(division) ? 
                                                    <Check className="mr-2 h-4 w-4" /> : 
                                                    <Send className="mr-2 h-4 w-4" />
                                                }
                                                {project.parallelUploadsCompletedBy?.includes(division) ? projectsDict.toast.divisionCompletedButton : projectsDict.toast.markDivisionCompleteButton}
                                             </Button>
                                        )}
                                    </div>
                                    <ul className="space-y-2">
                                        {items?.map((item) => renderChecklistItem(item, division))}
                                    </ul>
                                </div>
                            ))}
                        </CardContent>
                         {currentUser?.roles.includes('Admin Proyek') && project.status === 'Pending Parallel Design Uploads' && (
                             <CardFooter className="p-4 sm:p-6 pt-0">
                                  <Button
                                    onClick={() => handleProgressSubmit('all_files_confirmed')}
                                    disabled={isSubmitting || !allChecklistItemsUploaded}
                                    className="w-full sm:w-auto accent-teal"
                                    title={!allChecklistItemsUploaded ? "Semua file harus diunggah sebelum melanjutkan" : ""}
                                  >
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                    {projectsDict.confirmAllDesignsUploadedButton}
                                  </Button>
                              </CardFooter>
                         )}
                    </Card>
                 )}

                 <Card className="mb-6 shadow-md">
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle>{projectsDict.workflowHistoryTitle}</CardTitle>
                        <CardDescription>{projectsDict.workflowHistoryDesc}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0">
                        <Accordion type="single" collapsible className="w-full">
                             {groupedAndSortedHistory.length > 0 ? (
                                groupedAndSortedHistory.map((group, index) => (
                                <AccordionItem value={`item-${index}`} key={group.timestamp}>
                                    <AccordionTrigger disabled={group.files.length === 0} className={cn("hover:no-underline", group.files.length === 0 && "cursor-default")}>
                                        <div className="flex items-start gap-3 flex-1 text-left">
                                            <div className={`mt-1 h-3 w-3 rounded-full flex-shrink-0 ${index === 0 ? 'bg-primary animate-pulse' : 'bg-muted-foreground/50'}`}></div>
                                            <div>
                                                {group.entries.length > 0 ? group.entries.map((entry, entryIndex) => (
                                                    <p key={entryIndex} className="text-sm font-medium">{translateHistoryAction(entry.action)}</p>
                                                )) : <p className="text-sm font-medium italic">{projectsDict.uploadedFilesTitle}</p>}
                                                <p className="text-xs text-muted-foreground">{formatTimestamp(group.timestamp)}</p>
                                                {group.entries.map((entry, entryIndex) => (
                                                    entry.note && <p key={`note-${entryIndex}`} className="text-xs text-muted-foreground italic mt-1 whitespace-pre-wrap">{projectsDict.revisionNotePrefix} {entry.note}</p>
                                                ))}
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="pl-6 border-l-2 border-dashed ml-1.5">
                                            <h4 className="text-sm font-semibold mb-2 ml-4 text-muted-foreground">{projectsDict.uploadedFilesTitle}</h4>
                                            <ul className="space-y-2 ml-4">
                                            {group.files.map((file, fileIndex) => {
                                                const isFinancialFile = (
                                                    (file.uploadedBy === 'Admin Proyek' && file.name.toLowerCase().includes('penawaran')) ||
                                                    (file.uploadedBy === 'Akuntan') ||
                                                    (file.name.toLowerCase().includes('pembayaran'))
                                                );
                                                const canViewSensitiveFile = currentUser && currentUser.roles.some(r => ['Owner', 'Akuntan', 'Admin Developer'].includes(r));

                                                if (isFinancialFile && !canViewSensitiveFile) {
                                                    return (
                                                        <li key={`hidden-${fileIndex}`} className="flex items-center p-2 border rounded-md gap-2 bg-muted/50 cursor-not-allowed">
                                                            <FileLock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                                            <span className="text-sm font-medium text-muted-foreground italic">{projectsDict.sensitiveFileHidden}</span>
                                                        </li>
                                                    );
                                                }
                                                return (
                                                    <li key={fileIndex} className="flex items-center justify-between p-2 border rounded-md hover:bg-secondary/50 gap-2">
                                                        <div className="flex items-center gap-2 flex-grow min-w-0">
                                                            <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                                                            <span className="text-sm font-medium break-all">{file.name}</span>
                                                        </div>
                                                        {canDownloadFiles && (
                                                            <Button variant="ghost" size="icon" onClick={() => handleDownloadFile(file)} disabled={isDownloading || !!isDeletingFile} title={projectsDict.downloadFileTooltip} className="h-7 w-7 flex-shrink-0">
                                                                {isDownloading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4 text-primary" />}
                                                            </Button>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                            </ul>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                                ))
                             ) : (
                                <p className="text-sm text-muted-foreground">{projectsDict.loadingHistory}</p>
                             )}
                        </Accordion>
                    </CardContent>
                </Card>
                  
                  {showArchitectInitialImageUploadSection && (
                    <Card className="mb-6 shadow-md">
                        <CardHeader className="p-4 sm:p-6">
                            <CardTitle>{projectsDict.architectUploadInitialImagesTitle}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 pt-0">
                            <Dialog open={isInitialImageUploadDialogOpen} onOpenChange={setIsInitialImageUploadDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="w-full sm:w-auto">
                                        <Upload className="mr-2 h-4 w-4" /> {projectsDict.architectUploadInitialImagesButton}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>{projectsDict.architectUploadInitialImagesDialogTitle}</DialogTitle>
                                        <DialogDescription>{projectsDict.architectUploadInitialImagesDialogDesc}</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-2">
                                        <div className="grid w-full items-center gap-1.5">
                                            <Label htmlFor="initial-image-description">{projectsDict.descriptionLabel} ({projectsDict.optionalNoteLabel})</Label>
                                            <Textarea id="initial-image-description" placeholder={projectsDict.revisionFilesDescriptionPlaceholder} value={initialImageDescription} onChange={(e) => setInitialImageDescription(e.target.value)} disabled={isSubmittingInitialImages}/>
                                        </div>
                                        <div className="grid w-full items-center gap-1.5">
                                            <Label htmlFor="initial-image-files">{projectsDict.attachFilesLabel}</Label>
                                            <Input id="initial-image-files" type="file" multiple onChange={handleInitialImageFileChange} disabled={isSubmittingInitialImages}/>
                                        </div>
                                        {initialImageFiles.length > 0 && (
                                            <div className="space-y-2 rounded-md border p-3">
                                                <Label>{projectsDict.selectedFilesLabel} ({initialImageFiles.length})</Label>
                                                <ul className="list-disc list-inside text-sm space-y-1 max-h-32 overflow-y-auto">
                                                {initialImageFiles.map((file, index) => ( <li key={`initial-img-${index}`} className="flex items-center justify-between group"><span className="truncate max-w-[calc(100%-4rem)] sm:max-w-xs text-muted-foreground group-hover:text-foreground">{file.name} <span className="text-xs">({(file.size / 1024).toFixed(1)} KB)</span></span><Button variant="ghost" size="sm" type="button" onClick={() => removeInitialImageFile(index)} disabled={isSubmittingInitialImages} className="opacity-50 group-hover:opacity-100 flex-shrink-0"><Trash2 className="h-4 w-4 text-destructive" /></Button></li>))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                    <DialogFooter className="pt-2 sm:justify-between">
                                        <Button type="button" variant="outline" onClick={() => setIsInitialImageUploadDialogOpen(false)} disabled={isSubmittingInitialImages}>{projectsDict.cancelButton}</Button>
                                        <Button
                                            type="button"
                                            onClick={() => handleProgressSubmit('architect_uploaded_initial_images_for_struktur', initialImageFiles, initialImageDescription)}
                                            disabled={isSubmittingInitialImages}
                                            className="accent-teal"
                                        >
                                            {isSubmittingInitialImages ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                            {isSubmittingInitialImages ? projectsDict.submittingButton : projectsDict.submitButton}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardContent>
                    </Card>
                  )}


                <Card className="shadow-md">
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle>{projectsDict.currentProjectActionsTitle || "Current Project Actions"}</CardTitle>
                        <CardDescription>{project.nextAction || projectsDict.none}</CardDescription>
                    </CardHeader>
                   <CardContent className="p-4 sm:p-6 pt-0">
                      {showUploadSection && (
                         <div className="space-y-4 border-t pt-4 mt-4">
                           <h3 className="text-lg font-semibold">{project.status === 'Pending Post-Sidang Revision' ? projectsDict.uploadRevisedFilesTitle : (
                                project.status === 'Pending Pelunasan Invoice' ? 'Unggah Invoice Pelunasan' : 
                                project.status === 'Pending Sidang Registration Proof' ? 'Unggah Bukti Pendaftaran Sidang' :
                                projectsDict.uploadProgressTitle.replace('{role}', getTranslatedStatus(actingRole || ''))
                            )}</h3>
                           <div className="grid w-full items-center gap-1.5"><Label htmlFor="description">{projectsDict.descriptionLabel}</Label><Textarea id="description" placeholder={projectsDict.descriptionPlaceholder.replace('{division}', getTranslatedStatus(project.assignedDivision))} value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSubmitting}/></div>
                           <div className="grid w-full items-center gap-1.5">
                             <Label htmlFor="project-files">{projectsDict.attachFilesLabel}</Label>
                             <div className="flex flex-col sm:flex-row items-center gap-2">
                               <Input id="project-files" type="file" multiple onChange={handleFileChange} disabled={isSubmitting} className="flex-grow"/>
                               <Upload className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                             </div>
                           </div>
                           {uploadedFiles.length > 0 && (
                             <div className="space-y-2 rounded-md border p-3">
                               <Label>{projectsDict.selectedFilesLabel} ({uploadedFiles.length})</Label>
                               <ul className="list-disc list-inside text-sm space-y-1 max-h-32 overflow-y-auto">
                                 {uploadedFiles.map((file, index) => ( <li key={index} className="flex items-center justify-between group"><span className="truncate max-w-[calc(100%-4rem)] sm:max-w-xs text-muted-foreground group-hover:text-foreground">{file.name} <span className="text-xs">({(file.size / 1024).toFixed(1)} KB)</span></span><Button variant="ghost" size="sm" type="button" onClick={() => removeFile(index)} disabled={isSubmitting} className="opacity-50 group-hover:opacity-100 flex-shrink-0"><Trash2 className="h-4 w-4 text-destructive" /></Button></li>))}
                               </ul>
                             </div>
                           )}
                            <Button onClick={()=> handleProgressSubmit('submitted')}
                                disabled={isSubmitting || (project.status === 'Pending Pelunasan Invoice' && uploadedFiles.length === 0)}
                                className="w-full sm:w-auto accent-teal">
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                {isSubmitting ? projectsDict.submittingButton : projectsDict.submitButton}
                            </Button>
                         </div>
                       )}
                        {showFinalDocumentUploadSection && (
                            <Card className="mb-6 shadow-md border-primary/20">
                                <CardHeader className="p-4 sm:p-6">
                                    <CardTitle>{projectsDict.finalDocsSectionTitle}</CardTitle>
                                    <CardDescription>{projectsDict.finalDocsSectionDesc}</CardDescription>
                                </CardHeader>
                                <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
                                    <div>
                                        <h4 className="font-semibold mb-2">{projectsDict.finalDocsChecklistTitle}</h4>
                                        <ul className="space-y-2">
                                            {finalDocsChecklistStatus?.map((item, index, allItems) => renderFinalDocsChecklistItem(item, index, allItems))}
                                        </ul>
                                    </div>
                                </CardContent>
                                {currentUser?.roles.includes('Admin Proyek') && (
                                <CardFooter className="p-4 sm:p-6 border-t">
                                    <Button onClick={() => handleDecision('completed')} disabled={isSubmitting || !allFinalDocsUploaded} className="w-full sm:w-auto accent-teal">
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                        {projectsDict.completeProjectButton}
                                    </Button>
                                </CardFooter>
                                )}
                            </Card>
                        )}
                        {showSurveyDetailsInputSection && (
                            <div className="space-y-4 border-t pt-4 mt-4">
                                <h3 className="text-lg font-semibold">{projectsDict.nextActionDescriptions.inputSurveyDetails}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>{projectsDict.dateLabel}</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !surveyDate && "text-muted-foreground")} disabled={isSubmitting}>
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {surveyDate ? format(surveyDate, "PPP", { locale: language === 'id' ? IndonesianLocale : EnglishLocale }) : <span>{projectsDict.dateLabel}</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar mode="single" selected={surveyDate} onSelect={setSurveyDate} initialFocus locale={language === 'id' ? IndonesianLocale : EnglishLocale}/>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-1.5 relative">
                                        <Label htmlFor="surveyTime">{projectsDict.timeLabel}</Label>
                                        <Clock className="absolute left-2.5 top-9 h-4 w-4 text-muted-foreground" />
                                        <Input id="surveyTime" type="time" value={surveyTime} onChange={e => setSurveyTime(e.target.value)} disabled={isSubmitting} className="pl-8" onClick={(e) => (e.target as HTMLInputElement).showPicker()} />
                                    </div>
                                </div>
                                <div className="space-y-1.5"><Label htmlFor="surveyDescription">{projectsDict.descriptionLabel}</Label><Textarea id="surveyDescription" placeholder={projectsDict.surveyDescriptionPlaceholder} value={surveyDescription} onChange={e => setSurveyDescription(e.target.value)} disabled={isSubmitting}/></div>
                                
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <Button onClick={handleSurveyScheduleSubmit} disabled={isSubmitting || !surveyDate || !surveyTime} className="w-full sm:w-auto accent-teal">
                                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                      {isSubmitting ? projectsDict.schedulingButton : projectsDict.confirmScheduleButton}
                                  </Button>
                                </div>
                            </div>
                        )}
                        {showSurveyCompletionSection && (
                            <div className="space-y-4 border-t pt-4 mt-4">
                                <h3 className="text-lg font-semibold">{projectsDict.surveyCompletion.title}</h3>
                                {project.surveyDetails?.date && <p className="text-sm text-muted-foreground">{projectsDict.surveyCompletion.scheduledFor}: {formatDateOnly(project.surveyDetails.date)} @ {project.surveyDetails.time}</p>}
                                <div className="space-y-1.5"><Label htmlFor="surveyReportDescription">{projectsDict.surveyCompletion.reportNotesLabel}</Label><Textarea id="surveyReportDescription" placeholder={projectsDict.surveyCompletion.reportNotesPlaceholder} value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSubmitting}/></div>
                                <div className="grid w-full items-center gap-1.5"><Label htmlFor="survey-report-files">{projectsDict.attachFilesLabel} ({projectsDict.optionalReportLabel})</Label><div className="flex flex-col sm:flex-row items-center gap-2"><Input id="survey-report-files" type="file" multiple onChange={handleFileChange} disabled={isSubmitting} className="flex-grow"/><Upload className="h-5 w-5 text-muted-foreground flex-shrink-0" /></div></div>
                                  {uploadedFiles.length > 0 && (
                                     <div className="space-y-2 rounded-md border p-3">
                                         <Label>{projectsDict.selectedFilesLabel} ({uploadedFiles.length})</Label>
                                         <ul className="list-disc list-inside text-sm space-y-1 max-h-32 overflow-y-auto">
                                             {uploadedFiles.map((file, index) => ( <li key={index} className="flex items-center justify-between group"><span className="truncate max-w-[calc(100%-4rem)] sm:max-w-xs text-muted-foreground group-hover:text-foreground">{file.name} <span className="text-xs">({(file.size / 1024).toFixed(1)} KB)</span></span><Button variant="ghost" size="sm" type="button" onClick={() => removeFile(index)} disabled={isSubmitting} className="opacity-50 group-hover:opacity-100 flex-shrink-0"><Trash2 className="h-4 w-4 text-destructive" /></Button></li>))}
                                         </ul>
                                     </div>
                                  )}
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <TooltipProvider>
                                    <Tooltip delayDuration={100}>
                                        <TooltipTrigger asChild>
                                            <div className="w-full sm:w-auto">
                                                <Button 
                                                    onClick={handleSurveyCompletionSubmit} 
                                                    disabled={isSubmitting || !isSurveyDatePassed} 
                                                    className="w-full accent-teal"
                                                >
                                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                                    {isSubmitting ? projectsDict.submittingButton : projectsDict.surveyCompletion.confirmButton}
                                                </Button>
                                            </div>
                                        </TooltipTrigger>
                                        {!isSurveyDatePassed && (
                                            <TooltipContent>
                                                <p>{`Tidak dapat konfirmasi sebelum tanggal survei: ${formatDateOnly(project.surveyDetails?.date)} @ ${project.surveyDetails?.time}`}</p>
                                            </TooltipContent>
                                        )}
                                    </Tooltip>
                                  </TooltipProvider>

                                  <Dialog open={isRescheduleDialogOpen} onOpenChange={setIsRescheduleDialogOpen}>
                                      <DialogTrigger asChild>
                                          <Button variant="outline" disabled={isSubmitting}><RefreshCw className="mr-2 h-4 w-4"/>{projectsDict.rescheduleSurveyDialog.buttonText}</Button>
                                      </DialogTrigger>
                                      <DialogContent>
                                          <DialogHeader>
                                              <DialogTitle>{projectsDict.rescheduleSurveyDialog.title}</DialogTitle>
                                              <DialogDescription>{projectsDict.rescheduleSurveyDialog.description}</DialogDescription>
                                          </DialogHeader>
                                          <div className="grid gap-4 py-4">
                                              <div className="grid grid-cols-2 gap-4">
                                                  <div className="space-y-1.5">
                                                      <Label>{projectsDict.dateLabel}</Label>
                                                      <Popover>
                                                          <PopoverTrigger asChild>
                                                              <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !rescheduleDate && "text-muted-foreground")} disabled={isSubmitting}>
                                                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                                                  {rescheduleDate ? format(rescheduleDate, "PPP", { locale: language === 'id' ? IndonesianLocale : EnglishLocale }) : <span>{projectsDict.dateLabel}</span>}
                                                              </Button>
                                                          </PopoverTrigger>
                                                          <PopoverContent className="w-auto p-0">
                                                              <Calendar mode="single" selected={rescheduleDate} onSelect={setRescheduleDate} initialFocus locale={language === 'id' ? IndonesianLocale : EnglishLocale}/>
                                                          </PopoverContent>
                                                      </Popover>
                                                  </div>
                                                  <div className="relative space-y-1.5">
                                                      <Label htmlFor="reschedule-time">{projectsDict.timeLabel}</Label>
                                                      <Clock className="absolute left-2.5 top-9 h-4 w-4 text-muted-foreground" />
                                                      <Input id="reschedule-time" type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} disabled={isSubmitting} className="pl-8" onClick={(e) => (e.target as HTMLInputElement).showPicker()}/>
                                                  </div>
                                              </div>
                                              <div>
                                                  <Label htmlFor="reschedule-note">{projectsDict.rescheduleSurveyDialog.reasonLabel}</Label>
                                                  <Textarea id="reschedule-note" placeholder={projectsDict.rescheduleSurveyDialog.reasonPlaceholder} value={rescheduleNote} onChange={(e) => setRescheduleNote(e.target.value)} disabled={isSubmitting}/>
                                              </div>
                                          </div>
                                          <DialogFooter>
                                              <Button variant="outline" onClick={() => setIsRescheduleDialogOpen(false)} disabled={isSubmitting}>{projectsDict.cancelButton}</Button>
                                              <Button onClick={handleRescheduleSurveySubmit} disabled={isSubmitting || !rescheduleDate || !rescheduleTime || !rescheduleNote.trim()} className="accent-teal">
                                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                                {projectsDict.rescheduleSurveyDialog.confirmButton}
                                              </Button>
                                          </DialogFooter>
                                      </DialogContent>
                                  </Dialog>
                                </div>
                            </div>
                        )}
                        {showAdminFileUploadSection && (
                            <div className="space-y-4 border-t pt-4 mt-4">
                                <h3 className="text-lg font-semibold">Unggah Dokumen Administrasi Tambahan</h3>
                                <div className="space-y-1.5">
                                    <Label htmlFor="admin-file-note">Catatan (Opsional)</Label>
                                    <Textarea id="admin-file-note" placeholder="Tambahkan catatan untuk file yang diunggah..." value={adminFileNote} onChange={(e) => setAdminFileNote(e.target.value)} disabled={isUploadingAdminFiles} />
                                </div>
                                <div className="grid w-full items-center gap-1.5"><Label htmlFor="admin-files">Lampirkan File</Label><div className="flex flex-col sm:flex-row items-center gap-2"><Input id="admin-files" type="file" multiple onChange={handleAdminFileChange} disabled={isUploadingAdminFiles} className="flex-grow"/><Upload className="h-5 w-5 text-muted-foreground flex-shrink-0" /></div></div>
                                {adminFiles.length > 0 && (
                                   <div className="space-y-2 rounded-md border p-3">
                                       <Label>File Administrasi Terpilih ({adminFiles.length})</Label>
                                       <ul className="list-disc list-inside text-sm space-y-1 max-h-32 overflow-y-auto">
                                           {adminFiles.map((file, index) => ( <li key={index} className="flex items-center justify-between group"><span className="truncate max-w-[calc(100%-4rem)] sm:max-w-xs text-muted-foreground group-hover:text-foreground">{file.name} <span className="text-xs">({(file.size / 1024).toFixed(1)} KB)</span></span><Button variant="ghost" size="sm" type="button" onClick={() => removeAdminFile(index)} disabled={isUploadingAdminFiles} className="opacity-50 group-hover:opacity-100 flex-shrink-0"><Trash2 className="h-4 w-4 text-destructive" /></Button></li>))}
                                       </ul>
                                   </div>
                                )}
                                <Button onClick={handleAdminFileUpload} disabled={isUploadingAdminFiles || adminFiles.length === 0} className="w-full sm:w-auto">
                                    {isUploadingAdminFiles ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                    Unggah File Administrasi
                                </Button>
                            </div>
                        )}
                        {showOwnerDecisionSection && (
                            <div className="space-y-4 border-t pt-4 mt-4">
                            {project.progress === 20 && (
                                <>
                                    <h3 className="text-lg font-semibold">{projectsDict.ownerActionTitle}</h3>
                                    <p className="text-sm text-muted-foreground">{projectsDict.ownerActionDesc}</p>
                                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="destructive" disabled={isSubmitting} className="w-full sm:w-auto"><XCircle className="mr-2 h-4 w-4" /> {projectsDict.cancelProjectButton}</Button></AlertDialogTrigger>
                                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{projectsDict.cancelDialogTitle}</AlertDialogTitle><AlertDialogDescription>{projectsDict.cancelDialogDesc.replace('{projectName}', project.title)}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>{projectsDict.cancelButton}</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDecision('rejected')} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{projectsDict.confirmCancelButton}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                        </AlertDialog>
                                        <Button variant="outline" onClick={() => setIsGenericRevisionDialogOpen(true)} disabled={isSubmitting}><RefreshCw className="mr-2 h-4 w-4" /> {projectsDict.reviseOfferButton}</Button>
                                        <Button onClick={() => handleDecision('approved')} disabled={isSubmitting} className="accent-teal w-full sm:w-auto">{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}{projectsDict.approveButton}</Button>
                                    </div>
                                </>
                            )}
                            {project.progress === 30 && (
                                <>
                                    <h3 className="text-lg font-semibold">{projectsDict.dpInvoiceApprovalTitle}</h3>
                                    <p className="text-sm text-muted-foreground">{projectsDict.dpInvoiceApprovalDesc}</p>
                                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                                         <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="destructive" disabled={isSubmitting} className="w-full sm:w-auto"><XCircle className="mr-2 h-4 w-4" /> {projectsDict.cancelProjectButton}</Button></AlertDialogTrigger>
                                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{projectsDict.cancelDialogTitle}</AlertDialogTitle><AlertDialogDescription>{projectsDict.cancelDialogDesc.replace('{projectName}', project.title)}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>{projectsDict.cancelButton}</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDecision('rejected')} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{projectsDict.confirmCancelButton}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                        </AlertDialog>
                                        <Button variant="outline" onClick={() => setIsGenericRevisionDialogOpen(true)} disabled={isSubmitting}><RefreshCw className="mr-2 h-4 w-4" /> {projectsDict.reviseDPButton}</Button>
                                        <Button onClick={() => handleDecision('approved')} disabled={isSubmitting} className="accent-teal w-full sm:w-auto">{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}{projectsDict.approveButton}</Button>
                                    </div>
                                </>
                            )}
                            </div>
                        )}
                       {showSchedulingSection && (
                            <div className="space-y-4 border-t pt-4 mt-4">
                              <h3 className="text-lg font-semibold">{projectsDict.scheduleSidangTitle.replace('{role}', getTranslatedStatus(currentUser!.roles[0]))}</h3>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div className="space-y-1.5">
                                    <Label>{projectsDict.dateLabel}</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !scheduleDate && "text-muted-foreground")} disabled={isSubmitting}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {scheduleDate ? format(scheduleDate, "PPP", { locale: language === 'id' ? IndonesianLocale : EnglishLocale }) : <span>{projectsDict.dateLabel}</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar mode="single" selected={scheduleDate} onSelect={setScheduleDate} initialFocus locale={language === 'id' ? IndonesianLocale : EnglishLocale}/>
                                        </PopoverContent>
                                    </Popover>
                                 </div>
                                  <div className="space-y-1.5 relative">
                                    <Label htmlFor="scheduleTime">{projectsDict.timeLabel}</Label>
                                    <Clock className="absolute left-2.5 top-9 h-4 w-4 text-muted-foreground" />
                                    <Input id="scheduleTime" type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} disabled={isSubmitting} className="pl-8" onClick={(e) => (e.target as HTMLInputElement).showPicker()}/>
                                  </div>
                               </div>
                                <div className="space-y-1.5"><Label htmlFor="scheduleLocation">{projectsDict.locationLabel}</Label><Input id="scheduleLocation" placeholder={projectsDict.locationPlaceholder} value={scheduleLocation} onChange={e => setScheduleLocation(e.target.value)} disabled={isSubmitting} /></div>
                                <div className="space-y-1.5"><Label htmlFor="surat-keterangan">Surat Keterangan</Label><Input id="surat-keterangan" type="file" onChange={handleFileChange} disabled={isSubmitting}/></div>
                               <Button onClick={handleScheduleSubmit} disabled={isSubmitting || !scheduleDate || !scheduleTime || !scheduleLocation.trim()} className="w-full sm:w-auto accent-teal">{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}{isSubmitting ? projectsDict.schedulingButton : projectsDict.confirmScheduleButton}</Button>
                            </div>
                          )}
                        {showCalendarButton && (
                           <div className="border-t pt-4 mt-4">
                               <Button onClick={handleAddToCalendar} disabled={isAddingToCalendar} variant="outline" className="w-full sm:w-auto">
                                   {isAddingToCalendar ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.5-11.5L11 14.01l-2.5-2.51L7 13l4 4 6.5-6.5L16.5 8.5z"></path></svg>}
                                  {isAddingToCalendar ? projectsDict.addingCalendarButton : projectsDict.addCalendarButton}
                               </Button>
                           </div>
                        )}
                      {showSidangOutcomeSection && (
                           <div className="space-y-4 border-t pt-4 mt-4">
                             <h3 className="text-lg font-semibold">{projectsDict.sidangOutcomeTitle}</h3><p className="text-sm text-muted-foreground">{projectsDict.sidangOutcomeDesc}</p>
                               <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                                 <Button onClick={() => handleDecision('completed')} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto">{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}{projectsDict.markSuccessButton}</Button>
                                 <Dialog open={isPostSidangRevisionDialogOpen} onOpenChange={setIsPostSidangRevisionDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" disabled={isSubmitting} className="w-full sm:w-auto"><RefreshCw className="mr-2 h-4 w-4" />{projectsDict.markRevisionNeededButton}</Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>{projectsDict.postSidangRevisionDialogTitle}</DialogTitle>
                                            <DialogDescription>{projectsDict.postSidangRevisionDialogDesc}</DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <Label htmlFor="postSidangRevisionNote">{projectsDict.postSidangRevisionNoteLabel}</Label>
                                            <Textarea
                                                id="postSidangRevisionNote"
                                                placeholder={projectsDict.postSidangRevisionNotePlaceholder}
                                                value={postSidangRevisionNote}
                                                onChange={(e) => setPostSidangRevisionNote(e.target.value)}
                                                rows={4}
                                            />
                                            <Label htmlFor="postSidangRevisionFiles">Unggah Bukti Revisi</Label>
                                            <Input id="postSidangRevisionFiles" type="file" multiple onChange={handlePostSidangRevisionFileChange}/>
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setIsPostSidangRevisionDialogOpen(false)}>{projectsDict.cancelButton}</Button>
                                            <Button onClick={handlePostSidangRevisionSubmit} disabled={isSubmitting || !postSidangRevisionNote.trim()}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                {isSubmitting ? projectsDict.submittingButton : projectsDict.postSidangRevisionConfirmButton}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                 </Dialog>
                                 <Button variant="outline" onClick={() => handleDecision('reschedule_sidang')} disabled={isSubmitting} className="w-full sm:w-auto border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700">
                                    <CalendarClock className="mr-2 h-4 w-4" />{projectsDict.rescheduleSidangButton}
                                 </Button>
                                 <Button variant="destructive" onClick={() => handleDecision('canceled_after_sidang')} disabled={isSubmitting} className="w-full sm:w-auto">{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}{projectsDict.markFailButton}</Button>
                              </div>
                           </div>
                        )}
                      {showPostSidangRevisionSection && (
                            <div className="space-y-4 border-t pt-4 mt-4">
                                <h3 className="text-lg font-semibold">{projectsDict.postSidangRevisionActionsSectionTitle}</h3>
                                {currentUser?.roles.includes('Admin Proyek') && (
                                    <>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <Button variant="outline" onClick={() => handleNotifyDivision('Arsitek')} disabled={isSubmitting}>
                                                <Briefcase className="mr-2 h-4 w-4" /> {projectsDict.notifyArchitectForRevisionButton}
                                            </Button>
                                            <Button variant="outline" onClick={() => handleNotifyDivision('Struktur')} disabled={isSubmitting}>
                                                <Replace className="mr-2 h-4 w-4" /> {projectsDict.notifyStructureForRevisionButton}
                                            </Button>
                                            <Button variant="outline" onClick={() => handleNotifyDivision('MEP')} disabled={isSubmitting}>
                                                <Wrench className="mr-2 h-4 w-4" /> {projectsDict.notifyMEPForRevisionButton}
                                            </Button>
                                        </div>
                                        <Button onClick={() => handleDecision('revision_completed_proceed_to_invoice')} disabled={isSubmitting} className="accent-teal w-full sm:w-auto">
                                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                            {projectsDict.markRevisionCompletedAndProceedToInvoiceButton}
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}

                      {project.status === 'Completed' && ( <div className="border-t pt-4 mt-4 text-center"><CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" /><p className="font-semibold text-lg text-green-600">{projectsDict.completedMessage}</p></div>)}
                       {project.status === 'Canceled' && ( <div className="border-t pt-4 mt-4 text-center"><XCircle className="h-12 w-12 text-destructive mx-auto mb-2" /><p className="font-semibold text-lg text-destructive">{projectsDict.canceledMessage}</p></div>)}
                   </CardContent>
                 </Card>
                 <Dialog open={isGenericRevisionDialogOpen} onOpenChange={setIsGenericRevisionDialogOpen}>
                     <DialogContent>
                         <DialogHeader>
                             <DialogTitle>{projectsDict.confirmRevisionTitle}</DialogTitle>
                             <DialogDescription>{projectsDict.confirmRevisionDesc}</DialogDescription>
                         </DialogHeader>
                         <div className="grid gap-4 py-4">
                             <Label htmlFor="revisionNote">{projectsDict.revisionNoteLabel}</Label>
                             <Textarea id="revisionNote" placeholder={projectsDict.revisionNotePlaceholder} value={revisionNote} onChange={(e) => setRevisionNote(e.target.value)} disabled={isRevising} />
                         </div>
                         <DialogFooter>
                             <Button variant="outline" onClick={() => setIsGenericRevisionDialogOpen(false)} disabled={isRevising}>{projectsDict.cancelButton}</Button>
                             <Button onClick={handleReviseSubmit} disabled={isRevising || !revisionNote.trim()} className="bg-orange-500 hover:bg-orange-600">
                                 {isRevising && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                 {projectsDict.confirmRevisionButton}
                             </Button>
                         </DialogFooter>
                     </DialogContent>
                 </Dialog>

                <Dialog open={uploadDialogState.isOpen} onOpenChange={(isOpen) => setUploadDialogState({ ...uploadDialogState, isOpen })}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Unggah File untuk: {uploadDialogState.item?.name}</DialogTitle>
                            <DialogDescription>
                                Pilih file yang akan diunggah untuk item checklist ini.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="grid w-full items-center gap-1.5"><Label htmlFor="checklist-file-description">Deskripsi (Opsional)</Label><Textarea id="checklist-file-description" placeholder={"Masukkan deskripsi singkat..."} value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSubmitting}/></div>
                          <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="checklist-files">File</Label>
                            <Input id="checklist-files" type="file" multiple onChange={handleFileChange} disabled={isSubmitting} />
                          </div>
                           {uploadedFiles.length > 0 && (
                             <div className="space-y-2 rounded-md border p-3">
                               <Label>{projectsDict.selectedFilesLabel} ({uploadedFiles.length})</Label>
                               <ul className="list-disc list-inside text-sm space-y-1 max-h-32 overflow-y-auto">
                                 {uploadedFiles.map((file, index) => ( <li key={index} className="flex items-center justify-between group"><span className="truncate max-w-[calc(100%-4rem)] sm:max-w-xs text-muted-foreground group-hover:text-foreground">{file.name} <span className="text-xs">({(file.size / 1024).toFixed(1)} KB)</span></span><Button variant="ghost" size="sm" type="button" onClick={() => removeFile(index)} disabled={isSubmitting} className="opacity-50 group-hover:opacity-100 flex-shrink-0"><Trash2 className="h-4 w-4 text-destructive" /></Button></li>))}
                               </ul>
                             </div>
                           )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setUploadDialogState({ isOpen: false, item: null, division: null })} disabled={isSubmitting}>Batal</Button>
                            <Button onClick={() => handleProgressSubmit('submitted', uploadedFiles, description, uploadDialogState.item?.name, uploadDialogState.division || undefined)} disabled={isSubmitting || uploadedFiles.length === 0}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Unggah
                            </Button>
                        </DialogFooter>
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
