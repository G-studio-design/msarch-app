// src/components/dashboard/AdminActionsClient.tsx
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
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Edit, Save, XCircle, Loader2, Replace, Trash2, BellOff, MapPin } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { getDictionary } from '@/lib/translations';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import type { Project } from '@/types/project-types';
import type { WorkflowStep } from '@/types/workflow-types';
import type { AppSettings, AttendanceSettings } from '@/services/settings-service';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const defaultGlobalDict = getDictionary('en');

const statusWorkflowDetailsMap: Record<string, Partial<WorkflowStep>> = {
  'Pending Offer': { assignedDivision: 'Admin Proyek', nextActionDescription: 'Unggah Dokumen Penawaran', progress: 10 },
  'Pending Approval': { assignedDivision: 'Owner', nextActionDescription: 'Setujui Dokumen Penawaran/Faktur', progress: 20 }, 
  'Pending DP Invoice': { assignedDivision: 'Akuntan', nextActionDescription: 'Buat Faktur DP', progress: 25 },
  'Pending Admin Files': { assignedDivision: 'Admin Proyek', nextActionDescription: 'Unggah Berkas Administrasi', progress: 40 },
  'Pending Survey Details': { assignedDivision: 'Admin Proyek', nextActionDescription: 'Input Jadwal Survei & Unggah Hasil', progress: 45},
  'Pending Architect Files': { assignedDivision: 'Arsitek', nextActionDescription: 'Unggah Berkas Arsitektur', progress: 50 },
  'Pending Structure Files': { assignedDivision: 'Struktur', nextActionDescription: 'Unggah Berkas Struktur', progress: 70 },
  'Pending MEP Files': { assignedDivision: 'MEP', nextActionDescription: 'Unggah Berkas MEP', progress: 80 },
  'Pending Scheduling': { assignedDivision: 'Admin Proyek', nextActionDescription: 'Jadwalkan Sidang', progress: 90 },
  'Scheduled': { assignedDivision: 'Owner', nextActionDescription: 'Nyatakan Hasil Sidang', progress: 95 },
  'Pending Post-Sidang Revision': { assignedDivision: 'Admin Proyek', nextActionDescription: 'Lakukan revisi pasca-sidang', progress: 85 },
  'Completed': { assignedDivision: '', nextActionDescription: null, progress: 100 },
  'Canceled': { assignedDivision: '', nextActionDescription: null, progress: 0 },
  'Pending Consultation Docs': { assignedDivision: 'Admin Proyek', nextActionDescription: 'Unggah Ringkasan Konsultasi', progress: 10 },
  'Pending Review': { assignedDivision: 'Owner', nextActionDescription: 'Tinjau Ringkasan Konsultasi', progress: 50 },
};

type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

interface AdminActionsClientProps {
  initialData: {
    projects: Project[];
    availableStatuses: string[];
    appSettings: AppSettings;
  }
}

export default function AdminActionsClient({ initialData }: AdminActionsClientProps) {
  const { toast } = useToast();
  const { language } = useLanguage();
  const { currentUser } = useAuth();
  
  const [isClient, setIsClient] = React.useState(false);
  React.useEffect(() => { setIsClient(true) }, []);

  const dict = React.useMemo(() => getDictionary(language), [language]);
  const adminDict = React.useMemo(() => dict.adminActionsPage, [dict]);
  const dashboardDict = React.useMemo(() => dict.dashboardPage, [dict]);
  const manageUsersDict = React.useMemo(() => dict.manageUsersPage, [dict]);


  const [projects, setProjects] = React.useState<Project[]>(initialData.projects);
  const [availableStatuses, setAvailableStatuses] = React.useState<string[]>(initialData.availableStatuses);
  const [attendanceFeatureEnabled, setAttendanceFeatureEnabled] = React.useState(initialData.appSettings.feature_attendance_enabled);
  const [attendanceSettings, setAttendanceSettings] = React.useState<AttendanceSettings | null>({
      office_latitude: initialData.appSettings.office_latitude || 0,
      office_longitude: initialData.appSettings.office_longitude || 0,
      attendance_radius_meters: initialData.appSettings.attendance_radius_meters || 100,
      workingHours: initialData.appSettings.workingHours
  });

  const [isLoadingProjects, setIsLoadingProjects] = React.useState(false); // For refetching
  const [editingProjectId, setEditingProjectId] = React.useState<string | null>(null);
  const [newTitle, setNewTitle] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  const [isStatusChangeDialogOpen, setIsStatusChangeDialogOpen] = React.useState(false);
  const [projectForStatusChange, setProjectForStatusChange] = React.useState<Project | null>(null);
  const [newStatus, setNewStatus] = React.useState<string>('');
  const [newAssignedDivision, setNewAssignedDivision] = React.useState<string>('');
  const [newNextAction, setNewNextAction] = React.useState<string>('');
  const [newProgress, setNewProgress] = React.useState<number | string>('');
  const [reasonNote, setReasonNote] = React.useState('');
  const [availableDivisions, setAvailableDivisions] = React.useState<string[]>(['Owner', 'Akuntan', 'Admin Proyek', 'Arsitek', 'Struktur', 'MEP']); 

  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isClearingNotifications, setIsClearingNotifications] = React.useState(false);
  const [isUpdatingFeature, setIsUpdatingFeature] = React.useState(false);

  const [isUpdatingAttendanceSettings, setIsUpdatingAttendanceSettings] = React.useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = React.useState(false);


   const fetchData = React.useCallback(async () => {
        if (currentUser && Array.isArray(currentUser.roles) && currentUser.roles.some(r => ['Owner', 'Akuntan', 'Admin Proyek', 'Admin Developer'].includes(r))) {
            setIsLoadingProjects(true);
            try {
                const [projectsRes, statusesRes, settingsRes] = await Promise.all([
                   fetch('/api/projects'),
                   fetch('/api/workflows/statuses'),
                   fetch('/api/settings')
                ]);

                if (!projectsRes.ok || !statusesRes.ok || !settingsRes.ok) {
                  throw new Error('Failed to fetch initial data');
                }

                const [fetchedProjects, statuses, settings] = await Promise.all([
                  projectsRes.json(),
                  statusesRes.json(),
                  settingsRes.json(),
                ]);

                setProjects(fetchedProjects);
                setAvailableStatuses(statuses);
                setAttendanceFeatureEnabled(settings.feature_attendance_enabled);
                setAttendanceSettings({
                  office_latitude: settings.office_latitude || 0,
                  office_longitude: settings.office_longitude || 0,
                  attendance_radius_meters: settings.attendance_radius_meters || 100,
                  workingHours: settings.workingHours
                });
            } catch (error) {
                console.error("Failed to fetch data for admin actions:", error);
                toast({ variant: 'destructive', title: adminDict.toast.error, description: adminDict.toast.fetchError });
            } finally {
                setIsLoadingProjects(false);
            }
        } else {
           setIsLoadingProjects(false);
        }
   }, [currentUser, toast, adminDict]);


  const handleEditClick = (projectId: string, currentTitle: string) => {
    setEditingProjectId(projectId);
    setNewTitle(currentTitle);
  };

  const handleCancelEdit = () => {
    setEditingProjectId(null);
    setNewTitle('');
  };

  const handleSaveTitle = async (projectId: string) => {
    if (!newTitle.trim() || !currentUser) {
      toast({ variant: 'destructive', title: adminDict.toast.error, description: adminDict.toast.titleEmpty });
      return;
    }

    setIsSaving(true);
    try {
        const response = await fetch(`/api/projects/${projectId}/title`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        fetchData(); 
        toast({ title: adminDict.toast.titleUpdated, description: adminDict.toast.titleUpdatedDesc.replace('{id}', projectId) });
        handleCancelEdit();
    } catch (error: any) {
        console.error("Failed to update project title:", error);
        toast({ variant: 'destructive', title: adminDict.toast.error, description: error.message || 'Failed to save title.' });
    } finally {
        setIsSaving(false);
    }
  };

  const openStatusChangeDialog = (project: Project) => {
    setProjectForStatusChange(project);
    setNewStatus(project.status);
    setNewAssignedDivision(project.assignedDivision);
    setNewNextAction(project.nextAction || '');
    setNewProgress(project.progress);
    setReasonNote('');
    setIsStatusChangeDialogOpen(true);
  };

  React.useEffect(() => {
    if (newStatus && projectForStatusChange) {
        const defaults = statusWorkflowDetailsMap[newStatus];
        if (defaults) {
            if (newAssignedDivision === projectForStatusChange.assignedDivision || !availableDivisions.includes(newAssignedDivision)) {
                setNewAssignedDivision(defaults.assignedDivision || '');
            }
            if (newNextAction === (projectForStatusChange.nextAction || '') || newNextAction === '') {
                 setNewNextAction(defaults.nextActionDescription || '');
            }
            if (newProgress === projectForStatusChange.progress || newProgress === '') { 
                 setNewProgress(defaults.progress !== undefined ? defaults.progress : '');
            }
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newStatus, projectForStatusChange]);


  const handleManualStatusUpdate = async () => {
    if (!projectForStatusChange || !newStatus || !reasonNote.trim() || !currentUser) {
        toast({ variant: 'destructive', title: adminDict.toast.statusChangeError, description: adminDict.toast.statusChangeNoteRequired });
        return;
    }
    setIsSaving(true);
    const finalAssignedDivision = newAssignedDivision === "_NONE_" ? "" : newAssignedDivision;
    try {
        const response = await fetch('/api/projects/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              specialAction: 'manualUpdate',
              projectId: projectForStatusChange.id,
              newStatus,
              newAssignedDivision: finalAssignedDivision,
              newNextAction: newNextAction || null,
              newProgress: typeof newProgress === 'string' ? parseInt(newProgress, 10) : newProgress,
              adminUsername: currentUser.username,
              reasonNote
            }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        fetchData(); 
        toast({ title: adminDict.toast.statusChangeSuccess, description: adminDict.toast.statusChangeSuccessDesc.replace('{title}', projectForStatusChange.title).replace('{status}', getTranslatedStatus(newStatus) || newStatus).replace('{division}', getTranslatedRole(finalAssignedDivision) || finalAssignedDivision ) });
        setIsStatusChangeDialogOpen(false);
    } catch (error: any) {
        console.error("Failed to manually update project status:", error);
        toast({ variant: 'destructive', title: adminDict.toast.error, description: error.message || adminDict.toast.failedToUpdateStatus });
    } finally {
        setIsSaving(false);
    }
  };


   const getTranslatedStatus = React.useCallback((statusKey: string): string => {
        if (!dashboardDict?.status || !statusKey) return statusKey;
        const key = statusKey?.toLowerCase().replace(/ /g,'') as keyof typeof dashboardDict.status;
        return dashboardDict.status[key] || statusKey;
    }, [dashboardDict]);

   const getTranslatedRole = React.useCallback((roleKey: string) => {
    if (!manageUsersDict?.roles || !roleKey) {
      const fallbackDict = defaultGlobalDict.manageUsersPage.roles as Record<string, string>;
      const key = roleKey?.trim().replace(/\s+/g, '').toLowerCase() || "";
      return fallbackDict[key] || roleKey;
    }
    const normalizedKey = roleKey?.trim().replace(/\s+/g, '').toLowerCase() as keyof typeof manageUsersDict.roles;
    return manageUsersDict.roles[normalizedKey] || roleKey;
  }, [manageUsersDict, defaultGlobalDict]);


   const canPerformAdminActions = currentUser && Array.isArray(currentUser.roles) && currentUser.roles.some(r => ['Owner', 'Akuntan', 'Admin Proyek', 'Admin Developer'].includes(r));
   const canDeleteProjects = currentUser && Array.isArray(currentUser.roles) && currentUser.roles.some(r => ['Owner', 'Akuntan', 'Admin Developer'].includes(r));
   const canClearNotifications = currentUser && Array.isArray(currentUser.roles) && currentUser.roles.some(r => ['Owner', 'Admin Developer'].includes(r));

   const handleDeleteProject = async (projectId: string, projectTitle: string) => {
       if (!currentUser) return;
       setIsDeleting(true);
       try {
           const response = await fetch(`/api/projects/${projectId}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ deleterUserId: currentUser.id }),
           });
           const result = await response.json();
           if (!response.ok) throw new Error(result.message);
           
           fetchData(); 
           toast({ title: adminDict.toast.projectDeletedTitle || "Project Deleted", description: (adminDict.toast.projectDeletedDesc || "Project \"{title}\" has been deleted.").replace('{title}', projectTitle) });
       } catch (error: any) {
           console.error("Error deleting project:", error);
           toast({ variant: 'destructive', title: adminDict.toast.error, description: error.message || adminDict.toast.deleteError || "Failed to delete project." });
       } finally {
           setIsDeleting(false);
       }
   };

    const handleClearAllNotifications = async () => {
        setIsClearingNotifications(true);
        try {
            const response = await fetch('/api/notifications/clear-all', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser?.id })
             });
            if (!response.ok) throw new Error('Failed to clear notifications');
            
            toast({
                title: "Notifikasi Dibersihkan",
                description: "Semua riwayat notifikasi telah berhasil dihapus.",
            });
        } catch (error: any) {
            console.error("Error clearing notifications:", error);
            toast({
                variant: 'destructive',
                title: "Kesalahan",
                description: "Gagal membersihkan notifikasi: " + error.message,
            });
        } finally {
            setIsClearingNotifications(false);
        }
    };
    
    const handleFeatureToggle = async (enabled: boolean) => {
      setIsUpdatingFeature(true);
      try {
        const response = await fetch('/api/settings/feature-toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        });
        if (!response.ok) throw new Error('Failed to update feature setting.');

        setAttendanceFeatureEnabled(enabled);
        toast({
          title: adminDict.toast.featureToggleTitle,
          description: enabled ? adminDict.toast.attendanceEnabledDesc : adminDict.toast.attendanceDisabledDesc,
        });
        window.location.reload();
      } catch (error: any) {
        toast({ variant: 'destructive', title: adminDict.toast.error, description: error.message || "Failed to update feature setting." });
      } finally {
        setIsUpdatingFeature(false);
      }
    };
  
  const handleAttendanceSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setAttendanceSettings(prev => prev ? ({
        ...prev,
        [id]: id === 'office_latitude' || id === 'office_longitude' || id === 'attendance_radius_meters' ? parseFloat(value) || 0 : value
    }) : null);
  };
  
  const handleWorkingHoursChange = (day: DayOfWeek, field: 'checkIn' | 'checkOut' | 'isWorkDay', value: string | boolean) => {
    setAttendanceSettings(prev => {
        if (!prev) return null;
        return {
            ...prev,
            workingHours: {
                ...prev.workingHours,
                [day]: {
                    ...prev.workingHours[day as DayOfWeek],
                    [field]: value,
                },
            },
        };
    });
  };

  const handleSaveAttendanceSettings = async () => {
    if (!attendanceSettings) return;
    setIsUpdatingAttendanceSettings(true);
    try {
        const response = await fetch('/api/settings/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(attendanceSettings),
        });
        if (!response.ok) throw new Error('Failed to save attendance settings.');
        toast({
            title: "Pengaturan Absensi Disimpan",
            description: "Pengaturan lokasi, radius, dan jam kerja telah berhasil diperbarui.",
        });
    } catch (error: any) {
        toast({ variant: 'destructive', title: adminDict.toast.error, description: error.message || "Gagal menyimpan pengaturan absensi." });
    } finally {
        setIsUpdatingAttendanceSettings(false);
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
        toast({
            variant: "destructive",
            title: "Geolocation Tidak Didukung",
            description: "Browser Anda tidak mendukung pengambilan lokasi.",
        });
        return;
    }

    setIsFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            setAttendanceSettings(prev => prev ? ({
                ...prev,
                office_latitude: latitude,
                office_longitude: longitude,
            }) : null);
            toast({
                title: "Lokasi Ditemukan",
                description: "Koordinat lokasi kantor telah diperbarui. Jangan lupa simpan perubahan.",
            });
            setIsFetchingLocation(false);
        },
        (error) => {
            console.error("Geolocation error:", error);
            let description = "Gagal mendapatkan lokasi.";
            if (error.code === error.PERMISSION_DENIED) {
                description = "Izin lokasi diperlukan untuk menggunakan fitur ini. Harap aktifkan di pengaturan browser Anda.";
            }
            toast({
                variant: "destructive",
                title: "Gagal Mendapatkan Lokasi",
                description: description,
            });
            setIsFetchingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
};

  const showAttendanceSettingsCard = currentUser && Array.isArray(currentUser.roles) && currentUser.roles.some(r => ['Owner', 'Admin Developer'].includes(r));


  if (!isClient) {
    return (
        <div className="container mx-auto py-4 px-4 md:px-6 space-y-6">
           <Card>
              <CardHeader>
                <Skeleton className="h-7 w-3/5 mb-2" />
                <Skeleton className="h-4 w-4/5" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-40 w-full" />
              </CardContent>
           </Card>
       </div>
    );
  }

  if (!canPerformAdminActions) {
       return (
             <div className="container mx-auto py-4 px-4 md:px-6">
                <Card className="border-destructive">
                     <CardHeader>
                         <CardTitle className="text-destructive">{adminDict.accessDeniedTitle}</CardTitle>
                     </CardHeader>
                     <CardContent>
                         <p>{adminDict.accessDeniedDesc}</p>
                     </CardContent>
                </Card>
            </div>
       );
   }

  return (
     <div className="container mx-auto py-4 px-4 md:px-6 space-y-6">
      <Card>
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle className="text-xl md:text-2xl">{adminDict.title}</CardTitle>
                    <CardDescription>
                        {adminDict.description}
                    </CardDescription>
                </div>
                { canClearNotifications && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" className="w-full sm:w-auto">
                                <BellOff className="mr-2 h-4 w-4" />
                                {adminDict.clearNotificationsButton || "Clear All Notifications"}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{adminDict.clearNotificationsTitle || "Confirm Notification Cleanup"}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {adminDict.clearNotificationsDesc || "Are you sure you want to delete ALL notifications for ALL users? This action cannot be undone."}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isClearingNotifications}>{adminDict.cancelButton || "Cancel"}</AlertDialogCancel>
                                <AlertDialogAction
                                    className="bg-destructive hover:bg-destructive/90"
                                    onClick={handleClearAllNotifications}
                                    disabled={isClearingNotifications}
                                >
                                    {isClearingNotifications ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {adminDict.confirmClearButton || "Yes, Delete All"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>
        </CardHeader>
        <CardContent>
            {isLoadingProjects ? (
                <Skeleton className="h-40 w-full" />
            ) : (
            <>
            {/* Desktop View */}
            <div className="hidden md:block w-full overflow-x-auto rounded-md border">
               <Table>
                <TableHeader>
                  <TableRow>
                      <TableHead className="w-[200px]">{adminDict.tableHeaderId}</TableHead>
                    <TableHead>{adminDict.tableHeaderTitle}</TableHead>
                      <TableHead className="w-[120px] sm:w-[150px]">{adminDict.tableHeaderStatus}</TableHead>
                      <TableHead className="text-right w-auto">{adminDict.tableHeaderActions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        {adminDict.noProjects}
                      </TableCell>
                    </TableRow>
                  ) : (
                    projects.map((project) => (
                      <TableRow key={project.id}>
                          <TableCell className="text-xs font-mono break-words">{project.id}</TableCell>
                        <TableCell className="font-medium">
                          {editingProjectId === project.id ? (
                            <Input
                              value={newTitle}
                              onChange={(e) => setNewTitle(e.target.value)}
                              className="h-8"
                              disabled={isSaving}
                            />
                          ) : (
                              <span className="break-words">{project.title}</span>
                          )}
                        </TableCell>
                          <TableCell>{getTranslatedStatus(project.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-row justify-end items-center gap-1">
                            {editingProjectId === project.id ? (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleSaveTitle(project.id)} disabled={isSaving} title={adminDict.saveTitleActionTooltip}>
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-green-600" />}
                                </Button>
                                <Button variant="ghost" size="icon" onClick={handleCancelEdit} disabled={isSaving} title={adminDict.cancelEditActionTooltip}>
                                    <XCircle className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleEditClick(project.id, project.title)} disabled={isSaving || isDeleting} title={adminDict.editTitleActionTooltip}>
                                  <Edit className="h-4 w-4 text-primary" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => openStatusChangeDialog(project)} disabled={isSaving || isDeleting} title={adminDict.changeStatusActionTooltip}>
                                  <Replace className="h-4 w-4 text-orange-500" />
                                </Button>
                                  { canDeleteProjects && (
                                      <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                              <Button variant="ghost" size="icon" disabled={isSaving || isDeleting} title={adminDict.deleteProjectActionTooltip}>
                                                  <Trash2 className="h-4 w-4 text-destructive" />
                                              </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                              <AlertDialogHeader>
                                                  <AlertDialogTitle>{adminDict.deleteProjectDialogTitle}</AlertDialogTitle>
                                                  <AlertDialogDescription>
                                                      {adminDict.deleteProjectDialogDesc.replace('{title}', project.title)}
                                                  </AlertDialogDescription>
                                              </AlertDialogHeader>
                                              <AlertDialogFooter>
                                                  <AlertDialogCancel disabled={isDeleting}>{adminDict.cancelButton}</AlertDialogCancel>
                                                  <AlertDialogAction
                                                      className="bg-destructive hover:bg-destructive/90"
                                                      onClick={() => handleDeleteProject(project.id, project.title)}
                                                      disabled={isDeleting}
                                                  >
                                                      {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                      {adminDict.deleteProjectConfirmButton}
                                                  </AlertDialogAction>
                                              </AlertDialogFooter>
                                          </AlertDialogContent>
                                      </AlertDialog>
                                  )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {/* Mobile View */}
            <div className="grid gap-4 md:hidden">
                {projects.length === 0 && !isLoadingProjects ? (
                    <div className="text-center text-muted-foreground py-8">
                        {adminDict.noProjects}
                    </div>
                ) : (
                    projects.map((project) => (
                        <Card key={`mobile-${project.id}`}>
                            <CardHeader>
                                <CardTitle className="text-base break-words">{project.title}</CardTitle>
                                <CardDescription>{getTranslatedStatus(project.status)}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div><span className="font-semibold">{adminDict.tableHeaderId}:</span> <span className="font-mono text-xs">{project.id}</span></div>
                            </CardContent>
                            <CardFooter className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => openStatusChangeDialog(project)} disabled={isSaving || isDeleting}>
                                    <Replace className="mr-2 h-4 w-4 text-orange-500" />
                                    Change Status
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleEditClick(project.id, project.title)} disabled={isSaving || isDeleting}>
                                    <Edit className="mr-2 h-4 w-4 text-primary" />
                                    Edit Title
                                </Button>
                            </CardFooter>
                        </Card>
                    ))
                )}
            </div>
            </>
            )}
        </CardContent>
      </Card>
      
      {showAttendanceSettingsCard && (
        <Card>
          <CardHeader>
            <CardTitle>{adminDict.attendanceSettingsTitle || "Pengaturan Absensi"}</CardTitle>
            <CardDescription>{adminDict.attendanceSettingsDesc || "Atur lokasi kantor, radius, dan jam kerja untuk fitur absensi karyawan."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                      <Label htmlFor="office_latitude">Latitude Kantor</Label>
                      <Input id="office_latitude" type="number" value={attendanceSettings?.office_latitude} onChange={handleAttendanceSettingsChange} placeholder="-8.123456" disabled={isUpdatingAttendanceSettings || isFetchingLocation}/>
                  </div>
                  <div className="space-y-1">
                      <Label htmlFor="office_longitude">Longitude Kantor</Label>
                      <Input id="office_longitude" type="number" value={attendanceSettings?.office_longitude} onChange={handleAttendanceSettingsChange} placeholder="115.123456" disabled={isUpdatingAttendanceSettings || isFetchingLocation}/>
                  </div>
                  <div className="space-y-1">
                      <Label htmlFor="attendance_radius_meters">Radius Absensi (meter)</Label>
                      <Input id="attendance_radius_meters" type="number" value={attendanceSettings?.attendance_radius_meters} onChange={handleAttendanceSettingsChange} placeholder="100" disabled={isUpdatingAttendanceSettings || isFetchingLocation}/>
                  </div>
              </div>
              
              <div className="border-t pt-4">
                  <Button type="button" variant="outline" onClick={handleGetLocation} disabled={isUpdatingAttendanceSettings || isFetchingLocation}>
                      {isFetchingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                      Gunakan Lokasi Saat Ini
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                      Gunakan GPS perangkat Anda untuk mengatur koordinat kantor secara otomatis.
                  </p>
              </div>

              <div className="space-y-4 border-t pt-4">
                  <h4 className="font-semibold">{adminDict.workingHoursTitle || "Working Hours"}</h4>
                  <div className="space-y-3">
                      {attendanceSettings && Object.keys(attendanceSettings.workingHours).map((day) => (
                          <div key={day} className="grid grid-cols-3 sm:grid-cols-4 items-center gap-2 sm:gap-4 p-2 border rounded-md">
                              <Label className="font-medium col-span-3 sm:col-span-1">{adminDict.dayLabels[day as DayOfWeek]}</Label>
                              <div className="flex items-center space-x-2">
                                  <Switch
                                      id={`isWorkDay-${day}`}
                                      checked={attendanceSettings.workingHours[day as DayOfWeek].isWorkDay}
                                      onCheckedChange={(checked) => handleWorkingHoursChange(day as DayOfWeek, 'isWorkDay', checked)}
                                      disabled={isUpdatingAttendanceSettings}
                                  />
                                  <Label htmlFor={`isWorkDay-${day}`} className="text-sm">{adminDict.workDayLabel}</Label>
                              </div>
                              <div className={cn("space-y-1", !attendanceSettings.workingHours[day as DayOfWeek].isWorkDay && "opacity-50")}>
                                  <Label htmlFor={`checkIn-${day}`} className="text-xs text-muted-foreground">{adminDict.checkInLabel}</Label>
                                  <Input id={`checkIn-${day}`} type="time" value={attendanceSettings.workingHours[day as DayOfWeek].checkIn} onChange={(e) => handleWorkingHoursChange(day as DayOfWeek, 'checkIn', e.target.value)} disabled={isUpdatingAttendanceSettings || !attendanceSettings.workingHours[day as DayOfWeek].isWorkDay}/>
                              </div>
                              <div className={cn("space-y-1", !attendanceSettings.workingHours[day as DayOfWeek].isWorkDay && "opacity-50")}>
                                  <Label htmlFor={`checkOut-${day}`} className="text-xs text-muted-foreground">{adminDict.checkOutLabel}</Label>
                                  <Input id={`checkOut-${day}`} type="time" value={attendanceSettings.workingHours[day as DayOfWeek].checkOut} onChange={(e) => handleWorkingHoursChange(day as DayOfWeek, 'checkOut', e.target.value)} disabled={isUpdatingAttendanceSettings || !attendanceSettings.workingHours[day as DayOfWeek].isWorkDay}/>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

              <Button onClick={handleSaveAttendanceSettings} disabled={isUpdatingAttendanceSettings || !attendanceSettings || isFetchingLocation}>
                {isUpdatingAttendanceSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {adminDict.saveAttendanceSettingsButton || "Simpan Pengaturan Absensi"}
              </Button>
          </CardContent>
        </Card>
      )}

      {currentUser.roles.includes('Admin Developer') && (
        <Card>
          <CardHeader>
            <CardTitle>{adminDict.featureManagementTitle || "Feature Management"}</CardTitle>
            <CardDescription>{adminDict.featureManagementDesc || "Enable or disable major features for all users."}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4 rounded-md border p-4">
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">{adminDict.attendanceFeatureLabel || "Employee Attendance Feature"}</p>
                <p className="text-sm text-muted-foreground">{adminDict.attendanceFeatureDesc || "Toggles the visibility of the attendance system for all non-developer users."}</p>
              </div>
              <Switch
                checked={attendanceFeatureEnabled}
                onCheckedChange={handleFeatureToggle}
                disabled={isUpdatingFeature}
                aria-label="Toggle Attendance Feature"
              />
            </div>
          </CardContent>
        </Card>
      )}


       <Dialog open={isStatusChangeDialogOpen} onOpenChange={setIsStatusChangeDialogOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{adminDict.changeStatusDialogTitle.replace('{title}', projectForStatusChange?.title || '')}</DialogTitle>
                    <DialogDescription>{adminDict.changeStatusDialogDesc}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                        <Label htmlFor="currentStatus" className="text-left sm:text-right">{adminDict.currentStatusLabel}</Label>
                        <Input id="currentStatus" value={getTranslatedStatus(projectForStatusChange?.status || '')} disabled className="sm:col-span-3" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                        <Label htmlFor="newStatus" className="text-left sm:text-right">{adminDict.newStatusLabel}</Label>
                        <Select value={newStatus} onValueChange={setNewStatus}>
                            <SelectTrigger className="sm:col-span-3">
                                <SelectValue placeholder={adminDict.newStatusPlaceholder} />
                            </SelectTrigger>
                            <SelectContent>
                                {availableStatuses.map(status => (
                                    <SelectItem key={status} value={status}>{getTranslatedStatus(status)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                        <Label htmlFor="newAssignedDivision" className="text-left sm:text-right">{adminDict.newAssignedDivisionLabel}</Label>
                         <Select value={newAssignedDivision} onValueChange={setNewAssignedDivision}>
                            <SelectTrigger className="sm:col-span-3">
                                <SelectValue placeholder={adminDict.newAssignedDivisionPlaceholder} />
                            </SelectTrigger>
                            <SelectContent>
                                {availableDivisions.map(division => (
                                    <SelectItem key={division} value={division}>{getTranslatedRole(division)}</SelectItem>
                                ))}
                                <SelectItem value="_NONE_">{adminDict.noneAssignedLabel}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                        <Label htmlFor="newNextAction" className="text-left sm:text-right">{adminDict.newNextActionLabel}</Label>
                        <Input id="newNextAction" value={newNextAction} onChange={(e) => setNewNextAction(e.target.value)} className="sm:col-span-3" placeholder={adminDict.newNextActionPlaceholder}/>
                    </div>
                     <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                        <Label htmlFor="newProgress" className="text-left sm:text-right">{adminDict.newProgressLabel}</Label>
                        <Input id="newProgress" type="number" value={newProgress} onChange={(e) => setNewProgress(parseInt(e.target.value,10) || '')} className="sm:col-span-3" min="0" max="100"/>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                        <Label htmlFor="reasonNote" className="text-left sm:text-right">{adminDict.reasonNoteLabel}</Label>
                        <Textarea id="reasonNote" value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} className="sm:col-span-3" placeholder={adminDict.reasonNotePlaceholder}/>
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsStatusChangeDialogOpen(false)} disabled={isSaving}>{adminDict.cancelButton}</Button>
                    <Button type="button" onClick={handleManualStatusUpdate} disabled={isSaving || !reasonNote.trim()} className="accent-teal">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isSaving ? adminDict.savingChangesButton : adminDict.saveChangesButton}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
