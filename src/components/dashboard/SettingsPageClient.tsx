// src/components/dashboard/SettingsPageClient.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from '@/context/LanguageContext';
import { getDictionary } from '@/lib/translations';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Link as LinkIcon, Unlink, BellPlus, BellOff, XCircle, ShieldOff } from 'lucide-react';
import type { User, UpdateProfileData } from '@/types/user-types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams, useRouter } from 'next/navigation';
import { API_BASE_URL } from '@/config/api-config';

const defaultDict = getDictionary('en');

// Helper function to convert a base64 string to a Uint8Array.
const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export default function SettingsPageClient() {
   const { language, setLanguage } = useLanguage();
   const { currentUser, setCurrentUser: updateAuthContextUser } = useAuth();
   const { toast } = useToast();
   const searchParams = useSearchParams();
   const router = useRouter();

   const [isClient, setIsClient] = React.useState(false);
   const [dict, setDict] = React.useState(defaultDict);
   const settingsDict = dict.settingsPage;
   const notificationsDict = dict.notifications;

   const [username, setUsername] = React.useState('');
   const [email, setEmail] = React.useState('');
   const [whatsappNumber, setWhatsappNumber] = React.useState('');
   const [isUpdatingProfile, setIsUpdatingProfile] = React.useState(false);

   const [currentPassword, setCurrentPassword] = React.useState('');
   const [newPassword, setNewPassword] = React.useState('');
   const [confirmPassword, setConfirmPassword] = React.useState('');
   const [isUpdatingPassword, setIsUpdatingPassword] = React.useState(false);
   const [isDisconnectingGoogle, setIsDisconnectingGoogle] = React.useState(false);
   
   const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
   const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
   const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);
   const fileInputRef = React.useRef<HTMLInputElement>(null);


   const [notificationPermission, setNotificationPermission] = React.useState('default');
   const [isSubscribing, setIsSubscribing] = React.useState(false);
   
   // This key will be used to force the AvatarImage to re-render
   const [avatarKey, setAvatarKey] = React.useState(Date.now());
   const [isSecureContext, setIsSecureContext] = React.useState(false);


   React.useEffect(() => {
       if (currentUser) {
            setUsername(currentUser.username);
            setEmail(currentUser.email || '');
            setWhatsappNumber(currentUser.whatsappNumber || '');
       }
   }, [currentUser]);

   React.useEffect(() => {
     setIsClient(true);
     if (typeof window !== 'undefined') {
        setIsSecureContext(window.isSecureContext);
        if ('Notification' in window) {
           setNotificationPermission(Notification.permission);
        }
     }
   }, []);

   React.useEffect(() => { if (isClient) setDict(getDictionary(language)); }, [language, isClient]);

   React.useEffect(() => {
       const successParam = searchParams.get('success');
       const errorParam = searchParams.get('error');
       const emailParam = searchParams.get('email');

       if (isClient) {
           if (successParam === 'google_linked') {
               toast({ title: settingsDict.googleCalendarLinkSuccess, description: settingsDict.googleCalendarConnected });
               router.replace('/dashboard/settings', { scroll: false }); 
           }
           if (errorParam) {
               let description = settingsDict.toast[errorParam as keyof typeof settingsDict.toast] || decodeURIComponent(errorParam);
               if (errorParam === 'google_user_not_found' && emailParam) {
                   description = (settingsDict.googleCalendarUserNotFound || 'User with email {email} not found.').replace('{email}', decodeURIComponent(emailParam));
               }
               toast({ variant: 'destructive', title: settingsDict.googleCalendarError, description: description });
               router.replace('/dashboard/settings', { scroll: false });
           }
       }
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [isClient, searchParams, router, toast]);

  const handleLanguageChange = (value: string) => {
    setLanguage(value as 'en' | 'id');
    toast({ title: settingsDict.toast.languageChanged, description: settingsDict.toast.languageChangedDesc });
  };
  
  const handleEnableNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !currentUser) {
        toast({ title: notificationsDict.notSupportedTitle, description: notificationsDict.notSupportedDesc, variant: 'destructive' });
        return;
    }
    
    setIsSubscribing(true);
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            setNotificationPermission(permission);
            throw new Error(notificationsDict.permissionDeniedTitle);
        }

        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
            throw new Error("Service Worker not found. Please reload the page.");
        }

        let subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            toast({ title: "Notifications Already Enabled", description: "You are already subscribed to notifications." });
            setIsSubscribing(false);
            setNotificationPermission('granted');
            return;
        }

        const response = await fetch(`${API_BASE_URL}/api/notifications/vapid-public-key`);
        if (!response.ok) throw new Error("Could not fetch VAPID public key.");
        const vapidPublicKey = await response.text();
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey
        });
        
        await fetch(`${API_BASE_URL}/api/notifications/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, subscription: subscription })
        });
        
        toast({ title: notificationsDict.permissionGrantedTitle, description: notificationsDict.permissionGrantedDesc });
        setNotificationPermission('granted');

    } catch (err) {
        console.error('Failed to subscribe the user: ', err);
        toast({ title: notificationsDict.permissionErrorTitle, description: (err as Error).message || notificationsDict.permissionErrorDesc, variant: 'destructive' });
        if (Notification.permission !== 'granted') {
          setNotificationPermission(Notification.permission);
        }
    } finally {
        setIsSubscribing(false);
    }
  };


  const handleProfileUpdate = async () => {
     if (!currentUser) return;
     if (!username.trim() || !email.trim() || !/\S+@\S+\.\S+/.test(email)) {
        toast({ variant: 'destructive', title: settingsDict.toast.error, description: settingsDict.toast.invalidEmail });
        return;
     }

    setIsUpdatingProfile(true);
    try {
        const payload: Omit<UpdateProfileData, 'userId' | 'profilePictureUrl'> = {
            username: username,
            displayName: username,
            email: email,
            whatsappNumber: whatsappNumber,
        };

        const response = await fetch(`${API_BASE_URL}/api/users/${currentUser.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        updateAuthContextUser(prev => prev ? { ...prev, ...result } : null);
        toast({ title: settingsDict.toast.success, description: settingsDict.toast.profileUpdated });

    } catch (error: any) {
        toast({ variant: 'destructive', title: settingsDict.toast.error, description: error.message || settingsDict.toast.profileUpdateFailed });
    } finally {
        setIsUpdatingProfile(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!currentUser) return;
    if (!currentPassword || !newPassword || !confirmPassword) {
        toast({ variant: 'destructive', title: settingsDict.toast.error, description: settingsDict.toast.fieldsRequired });
        return;
    }
    if (newPassword !== confirmPassword) {
        toast({ variant: 'destructive', title: settingsDict.toast.error, description: settingsDict.toast.passwordsDontMatch });
        return;
    }
    if (newPassword.length < 6) {
        toast({ variant: 'destructive', title: settingsDict.toast.error, description: settingsDict.toast.passwordTooShort });
        return;
    }

    setIsUpdatingPassword(true);
    try {
        const response = await fetch(`${API_BASE_URL}/api/users/${currentUser.id}/password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        
        toast({ title: settingsDict.toast.success, description: settingsDict.toast.passwordUpdated });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
    } catch (error: any) {
        toast({ variant: 'destructive', title: settingsDict.toast.error, description: error.message || settingsDict.toast.passwordUpdateFailed });
    } finally {
        setIsUpdatingPassword(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    if (!currentUser) return;
    setIsDisconnectingGoogle(true);
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/google/disconnect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || settingsDict.googleCalendarErrorUnlinking);
        
        updateAuthContextUser(prev => prev ? { ...prev, ...result.user } : null);
        toast({ title: settingsDict.googleCalendarUnlinkSuccess });
    } catch (error: any) {
        toast({ variant: 'destructive', title: settingsDict.googleCalendarError, description: error.message });
    } finally {
        setIsDisconnectingGoogle(false);
    }
  };

  const getUserInitials = (name: string | undefined): string => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };
  
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({ variant: 'destructive', title: 'File too large', description: 'Please select an image under 2MB.' });
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile || !currentUser) return;

    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', avatarFile);

      const response = await fetch(`${API_BASE_URL}/api/users/${currentUser.id}/avatar`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      
      updateAuthContextUser(result.user);
      
      toast({ title: 'Success', description: 'Profile picture updated successfully.' });
      setAvatarFile(null);
      setAvatarPreview(null);
      setAvatarKey(Date.now()); // Force re-render
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
    } finally {
      setIsUploadingAvatar(false);
    }
  };


  if (!isClient || !currentUser) {
      return (
           <div className="container mx-auto py-4 px-4 md:px-6 space-y-6">
              <Card><CardHeader><Skeleton className="h-7 w-1/4 mb-2" /><Skeleton className="h-4 w-1/2" /></CardHeader>
                  <CardContent className="space-y-6">
                       <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
                       <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
                  </CardContent>
              </Card>
          </div>
      );
  }

  const isGoogleConnected = !!currentUser.googleRefreshToken;

  return (
     <div className="container mx-auto py-4 px-4 md:px-6 space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-xl md:text-2xl">{settingsDict.title}</CardTitle><CardDescription>{settingsDict.description}</CardDescription></CardHeader>
        <CardContent className="space-y-6">
            <Card><CardHeader><CardTitle className="text-lg">{settingsDict.profileCardTitle}</CardTitle></CardHeader>
                 <CardContent className="space-y-4">
                     <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-4">
                          <Avatar className="h-20 w-20 border-2 border-primary/30">
                            <AvatarImage src={avatarPreview || `${API_BASE_URL}/api/users/${currentUser.id}/avatar?v=${avatarKey}`} alt={currentUser.displayName || currentUser.username} />
                            <AvatarFallback className="text-xl bg-muted">{getUserInitials(currentUser.displayName || currentUser.username)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-grow space-y-2 text-center sm:text-left">
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleAvatarFileChange}
                              accept="image/png, image/jpeg"
                              className="hidden"
                            />
                            {avatarFile ? (
                                <div className="flex flex-col sm:flex-row items-center gap-2">
                                  <Button onClick={handleAvatarUpload} disabled={isUploadingAvatar}>
                                    {isUploadingAvatar ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                    {isUploadingAvatar ? settingsDict.uploadingPictureButton : settingsDict.changePictureButton}
                                  </Button>
                                  <Button variant="ghost" onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}>
                                    <XCircle className="mr-2 h-4 w-4" /> Cancel
                                  </Button>
                                </div>
                            ) : (
                                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                                    {settingsDict.changePictureButton}
                                </Button>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">{settingsDict.pictureHint}</p>
                          </div>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                         <div className="space-y-1"><Label htmlFor="username">{settingsDict.usernameLabel}</Label><Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={settingsDict.usernamePlaceholder} disabled={isUpdatingProfile}/></div>
                         <div className="space-y-1"><Label htmlFor="display-name">{settingsDict.displayNameLabel}</Label><Input id="display-name" value={currentUser?.displayName || ''} readOnly disabled className="cursor-not-allowed bg-muted/50"/></div>
                         <div className="space-y-1"><Label htmlFor="email">{settingsDict.emailLabel}</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={settingsDict.emailPlaceholder} disabled={isUpdatingProfile}/></div>
                         <div className="space-y-1"><Label htmlFor="whatsapp">{settingsDict.whatsappLabel}</Label><Input id="whatsapp" type="tel" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder={settingsDict.whatsappPlaceholder} disabled={isUpdatingProfile}/></div>
                    </div>
                     <Button onClick={handleProfileUpdate} disabled={isUpdatingProfile} className="w-full sm:w-auto">{isUpdatingProfile ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{settingsDict.updatingProfileButton}</>) : (settingsDict.updateProfileButton)}</Button>
                 </CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="text-lg">{settingsDict.passwordCardTitle}</CardTitle></CardHeader>
                 <CardContent className="space-y-4">
                     <div className="space-y-1"><Label htmlFor="current-password">{settingsDict.currentPasswordLabel}</Label><Input id="current-password" type="password" placeholder={settingsDict.currentPasswordPlaceholder} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={isUpdatingPassword} autoComplete="current-password"/></div>
                     <div className="space-y-1"><Label htmlFor="new-password">{settingsDict.newPasswordLabel}</Label><Input id="new-password" type="password" placeholder={settingsDict.newPasswordPlaceholder} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={isUpdatingPassword} autoComplete="new-password"/></div>
                     <div className="space-y-1"><Label htmlFor="confirm-password">{settingsDict.confirmPasswordLabel}</Label><Input id="confirm-password" type="password" placeholder={settingsDict.confirmPasswordPlaceholder} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isUpdatingPassword} autoComplete="new-password"/></div>
                     <Button onClick={handlePasswordUpdate} disabled={isUpdatingPassword || !currentPassword || !newPassword || !confirmPassword} className="w-full sm:w-auto">{isUpdatingPassword ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{settingsDict.updatingPasswordButton}</>) : (settingsDict.updatePasswordButton)}</Button>
                 </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">{settingsDict.notificationsCardTitle}</CardTitle>
                    <CardDescription>{settingsDict.pushNotificationsDesc}</CardDescription>
                </CardHeader>
                <CardContent>
                    {!isSecureContext ? (
                        <div className="flex items-center gap-2 text-amber-600">
                            <ShieldOff className="h-5 w-5" />
                            <div>
                                <p className="font-medium">Koneksi Tidak Aman</p>
                                <p className="text-xs">Notifikasi push hanya tersedia pada koneksi HTTPS.</p>
                            </div>
                        </div>
                    ) : notificationPermission === 'granted' ? (
                        <div className="flex items-center gap-2 text-green-600">
                            <BellPlus className="h-5 w-5" />
                            <p className="font-medium">{notificationsDict.permissionGrantedTitle}</p>
                        </div>
                    ) : notificationPermission === 'default' ? (
                        <Button onClick={handleEnableNotifications} disabled={isSubscribing} className="w-full sm:w-auto">
                            {isSubscribing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellPlus className="mr-2 h-4 w-4" />}
                            {settingsDict.enablePushNotificationsButton}
                        </Button>
                    ) : notificationPermission === 'denied' ? (
                        <div className="flex items-center gap-2 text-destructive">
                            <BellOff className="h-5 w-5" />
                            <div>
                                <p className="font-medium">{notificationsDict.permissionDeniedTitle}</p>
                                <p className="text-xs">{notificationsDict.permissionDeniedDesc}</p>
                            </div>
                        </div>
                    ) : (
                         <div className="flex items-center gap-2 text-muted-foreground">
                            <XCircle className="h-5 w-5" />
                            <p className="font-medium">{notificationsDict.notSupportedTitle}</p>
                        </div>
                    )}
                </CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="text-lg">{settingsDict.googleCalendarCardTitle}</CardTitle></CardHeader>
                 <CardContent>
                    {isGoogleConnected ? (
                        <div className="space-y-4">
                            <p className="text-sm text-green-600 font-medium">{settingsDict.googleCalendarConnected}</p>
                            <Button variant="destructive" onClick={handleGoogleDisconnect} disabled={isDisconnectingGoogle} className="w-full sm:w-auto">{isDisconnectingGoogle ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlink className="mr-2 h-4 w-4" />}{settingsDict.disconnectGoogleCalendar}</Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">{settingsDict.googleCalendarConnectDesc}</p>
                            <Button asChild className="accent-teal w-full sm:w-auto"><a href={`${API_BASE_URL}/api/auth/google/connect`}><LinkIcon className="mr-2 h-4 w-4" />{settingsDict.connectGoogleCalendar}</a></Button>
                        </div>
                    )}
                 </CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="text-lg">{settingsDict.languageCardTitle}</CardTitle><CardDescription>{settingsDict.languageCardDescription}</CardDescription></CardHeader>
                 <CardContent className="space-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="language-select">{settingsDict.languageSelectLabel}</Label>
                         <Select value={language} onValueChange={handleLanguageChange}>
                             <SelectTrigger id="language-select" className="w-full md:w-[280px]"><SelectValue placeholder={settingsDict.languageSelectPlaceholder} /></SelectTrigger>
                            <SelectContent><SelectItem value="en">{settingsDict.languageEnglish}</SelectItem><SelectItem value="id">{settingsDict.languageIndonesian}</SelectItem></SelectContent>
                          </Select>
                         <p className="text-xs text-muted-foreground">{settingsDict.languageSelectHint}</p>
                    </div>
                 </CardContent>
            </Card>
        </CardContent>
      </Card>
    </div>
  );
}
