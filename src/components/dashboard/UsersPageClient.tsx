// src/components/dashboard/UsersPageClient.tsx
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, User, UserCog, Edit, Loader2, Eye, EyeOff, Code, Wrench } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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
import { useLanguage } from '@/context/LanguageContext';
import { getDictionary } from '@/lib/translations';
import type { User as UserType } from '@/types/user-types';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';


const divisions = ['Owner', 'Akuntan', 'Admin Proyek', 'Arsitek', 'Struktur', 'MEP'];
const defaultGlobalDict = getDictionary('en');

const getAddUserSchema = (dictValidation: ReturnType<typeof getDictionary>['manageUsersPage']['validation']) => z.object({
    username: z.string().min(3, dictValidation.usernameMin),
    password: z.string().min(6, dictValidation.passwordMin),
    roles: z.array(z.string()).min(1, dictValidation.roleRequired),
});

const getEditUserSchema = (dictValidation: ReturnType<typeof getDictionary>['manageUsersPage']['validation']) => z.object({
    username: z.string().min(3, dictValidation.usernameMin),
    roles: z.array(z.string()).min(1, dictValidation.roleRequired),
});

interface UsersPageClientProps {
    initialUsers: Omit<UserType, 'password'>[];
}

export default function UsersPageClient({ initialUsers }: UsersPageClientProps) {
  const { toast } = useToast();
  const { language } = useLanguage();
  const { currentUser } = useAuth();
  
  const dict = React.useMemo(() => getDictionary(language), [language]);
  const usersDict = React.useMemo(() => dict.manageUsersPage, [dict]);

  const [users, setUsers] = React.useState<UserType[]>(initialUsers as UserType[]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = React.useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<UserType | null>(null);

  const fetchUsers = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const fetchedUsers = await response.json();
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast({ variant: 'destructive', title: usersDict.toast.error, description: usersDict.toast.fetchError });
    } finally {
      setIsLoading(false);
    }
  }, [toast, usersDict.toast]);

  const addUserSchema = React.useMemo(() => getAddUserSchema(usersDict.validation), [usersDict.validation]);
  const editUserSchema = React.useMemo(() => getEditUserSchema(usersDict.validation), [usersDict.validation]);

  type AddUserFormValues = z.infer<typeof addUserSchema>;
  type EditUserFormValues = z.infer<typeof editUserSchema>;

  const canManageUsers = React.useMemo(() => {
    if (!currentUser || !Array.isArray(currentUser.roles)) return false;
    return currentUser.roles.includes('Owner') || currentUser.roles.includes('Admin Developer');
  }, [currentUser]);

  const addUserForm = useForm<AddUserFormValues>({ 
      resolver: zodResolver(addUserSchema),
      defaultValues: {
          username: '',
          password: '',
          roles: [],
      }
  });
  const editUserForm = useForm<EditUserFormValues>({ 
      resolver: zodResolver(editUserSchema),
      defaultValues: {
          username: '',
          roles: [],
      }
  });

  React.useEffect(() => {
    if (editingUser) {
      editUserForm.reset({ 
          username: editingUser.username, 
          roles: editingUser.roles || [] 
      });
    }
  }, [editingUser, editUserForm]);

  const handleAddUser = async (data: AddUserFormValues) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      
      await fetchUsers();
      toast({ title: usersDict.toast.userAdded, description: usersDict.toast.userAddedDesc.replace('{username}', data.username) });
      addUserForm.reset();
      setIsAddUserDialogOpen(false);
    } catch (error: any) {
      addUserForm.setError('username', { type: 'manual', message: error.message });
      toast({ variant: 'destructive', title: usersDict.toast.error, description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditUser = async (data: EditUserFormValues) => {
    if (!editingUser) return;
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      
      await fetchUsers();
      toast({ title: usersDict.toast.userUpdated, description: usersDict.toast.userUpdatedDesc.replace('{username}', data.username) });
      setIsEditUserDialogOpen(false);
      setEditingUser(null);
    } catch (error: any) {
      editUserForm.setError('username', { type: 'manual', message: error.message });
      toast({ variant: 'destructive', title: usersDict.toast.error, description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      await fetchUsers();
      toast({ title: usersDict.toast.userDeleted, description: usersDict.toast.userDeletedDesc.replace('{username}', username) });
    } catch (error: any) {
      toast({ variant: 'destructive', title: usersDict.toast.error, description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const getTranslatedRole = React.useCallback((roles: string[]) => {
    if (!roles || roles.length === 0) return 'Not Assigned';
    
    if (!usersDict?.roles) {
      const fallbackDict = defaultGlobalDict.manageUsersPage.roles as Record<string, string>;
      return roles.map(role => {
        const key = role?.trim().replace(/\s+/g, '').toLowerCase() || "";
        return fallbackDict[key] || role;
      }).join(', ');
    }

    return roles.map(role => {
        if (!role) return '';
        const normalizedKey = role.trim().replace(/\s+/g, '').toLowerCase() as keyof typeof usersDict.roles;
        return usersDict.roles[normalizedKey] || role;
    }).join(', ');
  }, [usersDict, defaultGlobalDict]);

  const getRoleIcon = (role: string) => {
      if (!role) return <User className="h-4 w-4 text-muted-foreground" />;
      const roleLower = role.toLowerCase().trim();
      if (roleLower.includes('owner')) return <User className="h-4 w-4 text-blue-600" />;
      if (roleLower.includes('akuntan')) return <UserCog className="h-4 w-4 text-purple-600" />;
      if (roleLower.includes('admin proyek')) return <UserCog className="h-4 w-4 text-orange-600" />;
      if (roleLower.includes('arsitek')) return <User className="h-4 w-4 text-green-600" />;
      if (roleLower.includes('struktur')) return <User className="h-4 w-4 text-yellow-600" />;
      if (roleLower.includes('mep')) return <Wrench className="h-4 w-4 text-teal-600" />;
      if (roleLower.includes('admin developer')) return <Code className="h-4 w-4 text-gray-700" />;
      return <User className="h-4 w-4 text-muted-foreground" />;
  };

  const openEditDialog = (user: UserType) => {
    if (!currentUser) return;
    setEditingUser(user);
    setIsEditUserDialogOpen(true);
  };

  if (!canManageUsers) {
    return (
      <div className="container mx-auto py-4 px-4 md:px-6">
         <Card className="border-destructive">
            <CardHeader><CardTitle className="text-destructive">{usersDict.accessDeniedTitle}</CardTitle></CardHeader>
            <CardContent><p>{usersDict.accessDeniedDesc}</p></CardContent>
         </Card>
       </div>
    );
  }

  const AddUserDialog = ({ children }: { children: React.ReactNode }) => (
       <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader><DialogTitle>{usersDict.addUserDialogTitle}</DialogTitle><DialogDescription>{usersDict.addUserDialogDesc}</DialogDescription></DialogHeader>
              <Form {...addUserForm}>
                <form onSubmit={addUserForm.handleSubmit(handleAddUser)} className="space-y-4 py-4">
                  <FormField control={addUserForm.control} name="username" render={({ field }) => (<FormItem><FormLabel>{usersDict.usernameLabel}</FormLabel><FormControl><Input placeholder={usersDict.usernamePlaceholder} {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={addUserForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>{usersDict.passwordLabel}</FormLabel><FormControl><Input type="password" placeholder={usersDict.passwordPlaceholder} {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField
                    control={addUserForm.control}
                    name="roles"
                    render={() => (
                      <FormItem>
                        <FormLabel>{usersDict.roleLabel}</FormLabel>
                        <div className="grid grid-cols-2 gap-2 rounded-md border p-2">
                          {divisions.map((role) => (
                            <FormField
                              key={role}
                              control={addUserForm.control}
                              name="roles"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(role)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...(field.value || []), role])
                                          : field.onChange(field.value?.filter((value) => value !== role));
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal">{getTranslatedRole([role])}</FormLabel>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter className="pt-2"><Button type="button" variant="outline" onClick={() => setIsAddUserDialogOpen(false)} disabled={isProcessing}>{usersDict.cancelButton}</Button><Button type="submit" className="accent-teal" disabled={isProcessing}>{isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isProcessing ? usersDict.addingUserButton : usersDict.addUserSubmitButton}</Button></DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
  );

  const EditUserDialog = () => (
      <Dialog open={isEditUserDialogOpen} onOpenChange={(open) => { if (!open) setEditingUser(null); setIsEditUserDialogOpen(open); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>{usersDict.editUserDialogTitle.replace('{username}', editingUser?.username || '')}</DialogTitle><DialogDescription>{usersDict.editUserDialogDesc}</DialogDescription></DialogHeader>
          <Form {...editUserForm}>
            <form onSubmit={editUserForm.handleSubmit(handleEditUser)} className="space-y-4 py-4">
              <FormField control={editUserForm.control} name="username" render={({ field }) => (<FormItem><FormLabel>{usersDict.usernameLabel}</FormLabel><FormControl><Input placeholder={usersDict.usernamePlaceholder} {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField
                control={editUserForm.control}
                name="roles"
                render={() => (
                  <FormItem>
                    <FormLabel>{usersDict.roleLabel}</FormLabel>
                    <div className="grid grid-cols-2 gap-2 rounded-md border p-2">
                        {divisions.map((role) => (
                            <FormField
                            key={role}
                            control={editUserForm.control}
                            name="roles"
                            render={({ field }) => {
                                return (
                                <FormItem
                                    key={role}
                                    className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                    <FormControl>
                                    <Checkbox
                                        checked={field.value?.includes(role)}
                                        onCheckedChange={(checked) => {
                                        return checked
                                            ? field.onChange([...(field.value || []), role])
                                            : field.onChange(
                                                field.value?.filter(
                                                (value) => value !== role
                                                )
                                            )
                                        }}
                                    />
                                    </FormControl>
                                    <FormLabel className="font-normal">
                                        {getTranslatedRole([role])}
                                    </FormLabel>
                                </FormItem>
                                )
                            }}
                            />
                        ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-2"><Button type="button" variant="outline" onClick={() => setIsEditUserDialogOpen(false)} disabled={isProcessing}>{usersDict.cancelButton}</Button><Button type="submit" className="accent-teal" disabled={isProcessing || !editUserForm.formState.isDirty}>{isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isProcessing ? usersDict.editingUserButton : usersDict.editUserSubmitButton}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
  );


  return (
     <div className="container mx-auto py-4 px-4 md:px-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl md:text-2xl">{usersDict.title}</CardTitle>
            <CardDescription>{usersDict.description}</CardDescription>
          </div>
          <AddUserDialog>
             <Button className="accent-teal w-full sm:w-auto" disabled={isProcessing || isLoading || !canManageUsers}>
                <PlusCircle className="mr-2 h-4 w-4" /> {usersDict.addUserButton}
              </Button>
          </AddUserDialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (<Skeleton className="h-40 w-full" />) : (
            <div className="w-full overflow-x-auto rounded-md border">
              <Table><TableHeader><TableRow><TableHead>{usersDict.tableHeaderUsername}</TableHead><TableHead>{usersDict.tableHeaderRole}</TableHead><TableHead className="text-right">{usersDict.tableHeaderActions}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium break-words">{user.displayName || user.username}</TableCell>
                      <TableCell><div className="flex items-center gap-2">{getRoleIcon(user.roles?.[0])}<span>{getTranslatedRole(user.roles)}</span></div></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(user)} disabled={isProcessing} title={usersDict.editUserButtonLabel}><Edit className="h-4 w-4 text-blue-500" /></Button>
                          <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" disabled={isProcessing || user.id === currentUser?.id} title={usersDict.deleteUserButtonLabel}><Trash2 className={user.id === currentUser?.id ? 'h-4 w-4 text-muted-foreground' : 'h-4 w-4 text-destructive'} /></Button></AlertDialogTrigger>
                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{usersDict.deleteDialogTitle}</AlertDialogTitle><AlertDialogDescription>{usersDict.deleteDialogDesc.replace('{username}', user.username)}</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel disabled={isProcessing}>{usersDict.deleteDialogCancel}</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteUser(user.id, user.username)} disabled={isProcessing}>{isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{usersDict.deleteDialogConfirm}</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <EditUserDialog />
    </div>
  );
}
