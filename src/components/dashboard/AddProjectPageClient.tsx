// src/components/dashboard/AddProjectPageClient.tsx
'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { getDictionary } from '@/lib/translations';
import { Loader2, Upload, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { DEFAULT_WORKFLOW_ID } from '@/config/workflow-constants';
import { API_BASE_URL } from '@/config/api-config';

const getAddProjectSchema = (dictValidation: ReturnType<typeof getDictionary>['addProjectPage']['validation']) => z.object({
  title: z.string().min(5, dictValidation.titleMin),
});

const defaultDict = getDictionary('en');

export default function AddProjectPageClient() {
  const { currentUser } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const router = useRouter();
  const [isClient, setIsClient] = React.useState(false);
  
  const addProjectDict = React.useMemo(() => getDictionary(language).addProjectPage, [language]);
  const dashboardDict = React.useMemo(() => getDictionary(language).dashboardPage, [language]);

  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const addProjectSchema = React.useMemo(() => getAddProjectSchema(addProjectDict.validation), [addProjectDict.validation]);
  type AddProjectFormValues = z.infer<typeof addProjectSchema>;

  const form = useForm<AddProjectFormValues>({
    resolver: zodResolver(addProjectSchema),
    defaultValues: {
      title: '',
    },
  });
  
  React.useEffect(() => {
    if (isClient && addProjectDict?.validation) {
      form.trigger();
    }
  }, [addProjectDict, form, isClient]);

  const canAddProject = React.useMemo(() => {
    if (!currentUser || !Array.isArray(currentUser.roles)) return false;
    const allowedRoles = ['Owner', 'Admin Proyek', 'Admin Developer', 'Arsitek', 'Struktur', 'MEP'];
    return currentUser.roles.some(role => allowedRoles.includes(role));
}, [currentUser]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const filesArray = Array.from(event.target.files);
      setSelectedFiles(prevFiles => [...prevFiles, ...filesArray]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const getTranslatedStatus = React.useCallback((statusKey: string) => {
    if (!dashboardDict?.status || !statusKey) return statusKey;
    const key = statusKey?.toLowerCase().replace(/ /g, '') as keyof typeof dashboardDict.status;
    return dashboardDict.status[key] || statusKey;
  }, [dashboardDict]);

  const onSubmit = async (data: AddProjectFormValues) => {
    if (!canAddProject || !currentUser) return;

    setIsLoading(true);
    form.clearErrors();

    try {
      const formData = new FormData();
      formData.append('title', data.title);
      formData.append('workflowId', DEFAULT_WORKFLOW_ID);
      formData.append('createdBy', currentUser.username);
      formData.append('userId', currentUser.id);
      selectedFiles.forEach(file => formData.append('files', file));

      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: 'POST',
        body: formData,
      });

      const newProject = await response.json();
      if (!response.ok) {
        throw new Error(newProject.message || 'Failed to create project.');
      }

      const firstStepAssignedDivision = newProject.assignedDivision;
      const translatedDivision = getTranslatedStatus(firstStepAssignedDivision) || firstStepAssignedDivision;

      toast({
        title: addProjectDict.toast.success,
        description: (addProjectDict.toast.successDesc || defaultDict.addProjectPage.toast.successDesc)
          .replace('{title}', `"${newProject.title}"`) 
          .replace('{division}', translatedDivision),
      });

      form.reset({ title: ''});
      setSelectedFiles([]);
      router.push('/dashboard/projects'); 

    } catch (error: any) {
      console.error('Failed to add project:', error);
      toast({
        variant: 'destructive',
        title: addProjectDict.toast.error,
        description: error.message || 'An unexpected error occurred while creating the project.',
      });
    } finally {
      setIsLoading(false);
    }
  };

    if (!isClient) {
        return (
              <div className="container mx-auto py-4 px-4 md:px-6">
                 <Card>
                     <CardHeader>
                         <Skeleton className="h-7 w-1/3 mb-2" />
                         <Skeleton className="h-4 w-2/3" />
                     </CardHeader>
                     <CardContent>
                         <div className="space-y-4">
                             <Skeleton className="h-10 w-full" />
                             <Skeleton className="h-20 w-full" /> 
                             <Skeleton className="h-10 w-32" />
                         </div>
                     </CardContent>
                 </Card>
             </div>
        );
    }

    if (!canAddProject) {
       return (
          <div className="container mx-auto py-4 px-4 md:px-6">
           <Card className="border-destructive">
             <CardHeader>
               <CardTitle className="text-destructive">{addProjectDict.accessDeniedTitle || defaultDict.manageUsersPage.accessDeniedTitle}</CardTitle>
             </CardHeader>
             <CardContent>
               <p>{addProjectDict.accessDenied || defaultDict.manageUsersPage.accessDeniedDesc}</p>
             </CardContent>
           </Card>
         </div>
       );
    }

  return (
     <div className="container mx-auto py-4 px-4 md:px-6">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
           <CardTitle className="text-xl md:text-2xl">{addProjectDict.title}</CardTitle>
          <CardDescription>{addProjectDict.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{addProjectDict.titleLabel}</FormLabel>
                    <FormControl>
                      <Input placeholder={addProjectDict.titlePlaceholder} {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                 <Label htmlFor="project-files">{addProjectDict.filesLabel}</Label>
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                      <Input
                         id="project-files"
                         type="file"
                         multiple
                         onChange={handleFileChange}
                         disabled={isLoading}
                         className="flex-grow"
                       />
                       <Upload className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                 </div>
               </div>

                 {selectedFiles.length > 0 && (
                   <div className="space-y-2 rounded-md border p-3">
                     <Label>{(addProjectDict.selectedFilesLabel || defaultDict.addProjectPage.selectedFilesLabel)} ({selectedFiles.length})</Label>
                     <ul className="list-disc list-inside text-sm space-y-1 max-h-32 overflow-y-auto">
                       {selectedFiles.map((file, index) => (
                         <li key={index} className="flex items-center justify-between group">
                            <span className="truncate max-w-[calc(100%-4rem)] sm:max-w-xs text-muted-foreground group-hover:text-foreground">
                            {file.name} <span className="text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
                           </span>
                           <Button
                               variant="ghost"
                               size="sm"
                               type="button"
                               onClick={() => removeFile(index)}
                               disabled={isLoading}
                               className="opacity-50 group-hover:opacity-100 flex-shrink-0"
                            >
                               <Trash2 className="h-4 w-4 text-destructive" />
                           </Button>
                         </li>
                       ))}
                     </ul>
                   </div>
                 )}

               <div className="flex flex-col sm:flex-row justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading} className="w-full sm:w-auto">
                    {addProjectDict.cancelButton || defaultDict.manageUsersPage.cancelButton}
                 </Button>
                  <Button type="submit" className="accent-teal w-full sm:w-auto" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isLoading ? addProjectDict.creatingButton : addProjectDict.createButton}
                 </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
