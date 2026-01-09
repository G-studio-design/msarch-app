// src/components/layout/DashboardLayoutWrapper.tsx
'use client';

import type { ReactNode } from 'react';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Settings,
  LogOut,
  UserCog,
  PanelRightOpen,
  User,
  Loader2,
  Bell,
  MessageSquareWarning,
  FileBarChart,
  GitFork,
  Wrench,
  Replace,
  Plane,
  ShieldCheck,
  Code,
  CalendarCheck,
  FileClock,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/context/LanguageContext';
import { getDictionary } from '@/lib/translations';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Notification } from '@/services/notification-service';
import { API_BASE_URL } from '@/config/api-config';

type LayoutDict = ReturnType<typeof getDictionary>['dashboardLayout'];

type MenuItem = {
  href: string;
  icon: React.ComponentType<any>;
  labelKey: keyof LayoutDict; 
  roles: string[];
  featureFlag?: boolean;
};

const getUserRoleIcon = (role: string | undefined): React.ComponentType<any> => {
    if (!role) return User;
    const roleLower = role.toLowerCase().trim();
    switch(roleLower) {
        case 'owner': return User;
        case 'akuntan': return UserCog; 
        case 'admin proyek': return UserCog;
        case 'arsitek': return User;
        case 'struktur': return User;
        case 'mep': return Wrench;
        case 'admin developer': return Code;
        default: return User;
    }
};

const getUserInitials = (name: string | undefined): string => {
    if (!name) return '?';
    return name.split(' ')
               .map(n => n[0])
               .join('')
               .toUpperCase()
               .slice(0, 2);
};

interface DashboardLayoutWrapperProps {
  children: ReactNode;
  attendanceEnabled: boolean;
}

export default function DashboardLayoutWrapper({ children, attendanceEnabled }: DashboardLayoutWrapperProps) {
  const { language } = useLanguage();
  const { currentUser, logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  // This state is to force re-render of Avatar when user object changes
  const [avatarKey, setAvatarKey] = useState(Date.now());


  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Update the avatarKey whenever the profile picture URL changes in the context
  useEffect(() => {
      if (currentUser?.profilePictureUrl) {
          setAvatarKey(Date.now());
      }
  }, [currentUser?.profilePictureUrl]);


  // Listener for messages from the Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleServiceWorkerMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'navigate' && event.data.url) {
          router.push(event.data.url);
          // Dispatch a custom event to tell the page to refresh its data
          window.dispatchEvent(new CustomEvent('refresh-data'));
        }
      };

      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

      // Cleanup listener on component unmount
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      };
    }
  }, [router]);

  const { layoutDict, notificationsDict, manageUsersDict } = useMemo(() => {
    const defaultDict = getDictionary('en'); 
    if (!isClient) {
      return {
        layoutDict: defaultDict.dashboardLayout,
        notificationsDict: defaultDict.notifications,
        manageUsersDict: defaultDict.manageUsersPage,
      };
    }
    const currentDict = getDictionary(language);
    return {
      layoutDict: currentDict.dashboardLayout,
      notificationsDict: currentDict.notifications,
      manageUsersDict: currentDict.manageUsersPage,
    };
  }, [isClient, language]);


  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Check notification permission status on load
  useEffect(() => {
    if (isClient && 'Notification' in window && Notification.permission === 'denied') {
        toast({
            title: notificationsDict.permissionDeniedTitle,
            description: notificationsDict.permissionDeniedDesc,
            variant: 'destructive',
            duration: 10000
        });
    }
  }, [isClient, toast, notificationsDict]);


  const fetchNotifications = useCallback(async () => {
    if (isClient && currentUser) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/notifications?userId=${currentUser.id}`);
        if (!response.ok) {
           console.error("Failed to fetch notifications from API");
           return;
        }
        const fetchedNotifications: Notification[] = await response.json();
        
        setNotifications(prevNotifications => {
          if (JSON.stringify(prevNotifications) !== JSON.stringify(fetchedNotifications)) {
            return fetchedNotifications;
          }
          return prevNotifications;
        });

      } catch (error) {
         console.error("Failed to fetch notifications:", error);
      }
    }
  }, [isClient, currentUser]);
  
  // Effect for fetching in-app notifications (bell icon)
  useEffect(() => {
    if (isClient && currentUser) {
      fetchNotifications();
      const intervalId = setInterval(fetchNotifications, 30000); 
      return () => clearInterval(intervalId);
    }
  }, [isClient, currentUser, fetchNotifications]);


  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.isRead).length);
  }, [notifications]);

  const menuItems = useMemo(() => {
    const allRoles = ["Owner", "Akuntan", "Admin Proyek", "Arsitek", "Struktur", "MEP", "Admin Developer"];
    
    const items: MenuItem[] = [
      { href: "/dashboard", icon: LayoutDashboard, labelKey: "dashboard", roles: allRoles },
      { href: "/dashboard/projects", icon: ClipboardList, labelKey: "projects", roles: allRoles },
      { href: "/dashboard/users", icon: Users, labelKey: "manageUsers", roles: ["Owner", "Admin Developer"] },
      { href: "/dashboard/attendance", icon: CalendarCheck, labelKey: "attendance", roles: allRoles, featureFlag: true },
      { href: "/dashboard/attendance-report", icon: FileClock, labelKey: "attendanceReport", roles: ["Owner", "Admin Developer"], featureFlag: true },
      { href: "/dashboard/leave-request/new", icon: Plane, labelKey: "requestLeave", roles: allRoles },
      { href: "/dashboard/admin-actions/leave-approvals", icon: ShieldCheck, labelKey: "leaveApprovals", roles: ["Owner"] },
      { href: "/dashboard/admin-actions", icon: Replace, labelKey: "adminActions", roles: ["Owner", "Akuntan", "Admin Proyek", "Admin Developer"] },
      { href: "/dashboard/admin-actions/workflows", icon: GitFork, labelKey: "manageWorkflows", roles: ["Admin Developer"] },
      { href: "/dashboard/monthly-report", icon: FileBarChart, labelKey: "monthlyReport", roles: ["Owner", "Akuntan", "Admin Proyek", "Admin Developer"] },
      { href: "/dashboard/settings", icon: Settings, labelKey: "settings", roles: allRoles },
    ];
    return items;
  }, []);


  const visibleMenuItems = useMemo(() => {
    if (isClient && currentUser && Array.isArray(currentUser.roles)) {
      return menuItems.filter(item => {
        const hasRole = item.roles.some(requiredRole => currentUser.roles.includes(requiredRole));
        if (item.featureFlag) {
          const isAdminDev = currentUser.roles.includes('Admin Developer');
          return isAdminDev || (hasRole && attendanceEnabled);
        }
        return hasRole;
      });
    }
    return [];
  }, [isClient, currentUser, menuItems, attendanceEnabled]);

  const RoleIcon = useMemo(() => isClient && currentUser && currentUser.roles && currentUser.roles.length > 0 ? getUserRoleIcon(currentUser.roles[0]) : User, [isClient, currentUser]);


   const getTranslatedRole = useCallback((role: string | string[]): string => {
       const rolesDict = manageUsersDict.roles as Record<string, string>;
       if (!isClient || !rolesDict || !role) return Array.isArray(role) ? role.join(', ') : (role || '');
       
       const rolesToTranslate = Array.isArray(role) ? role : [role];
       
       return rolesToTranslate.map(r => {
           const roleKey = r.trim().replace(/\s+/g, '').toLowerCase() as keyof typeof rolesDict;
           return rolesDict?.[roleKey] || r;
       }).join(', ');
   }, [isClient, manageUsersDict]);


   const formatTimestamp = useCallback((timestamp: string): string => {
       if (!isClient) return '...';

       const now = new Date();
       const past = new Date(timestamp);
       const diffSeconds = Math.round((now.getTime() - past.getTime()) / 1000);
       const diffMinutes = Math.round(diffSeconds / 60);
       const diffHours = Math.round(diffMinutes / 60);
       const diffDays = Math.round(diffHours / 24);

       if (diffSeconds < 60) return `${diffSeconds}s ago`;
       if (diffMinutes < 60) return `${diffMinutes}m ago`;
       if (diffHours < 24) return `${diffHours}h ago`;
       return `${diffDays}d ago`;
   }, [isClient]);

   const handleNotificationClick = useCallback(async (notification: Notification) => {
    setIsPopoverOpen(false);
    
    if (!notification.isRead) {
        try {
            await fetch(`${API_BASE_URL}/api/notifications/mark-as-read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationId: notification.id }),
            });
            setNotifications(prev =>
                prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
            );
        } catch (error) {
            console.error("Failed to mark notification as read via API:", error);
        }
    }
    
    if (notification.url) {
        router.push(notification.url);
        // Dispatch a custom event to tell the page to refresh its data
        window.dispatchEvent(new CustomEvent('refresh-data'));
    }
}, [router]);

   const handleLogout = async () => {
    const unsubscribe = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          const subscription = await registration?.pushManager.getSubscription();

          if (subscription) {
            console.log("Unsubscribing from push notifications...");
            await fetch(`${API_BASE_URL}/api/notifications/unsubscribe`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subscription }),
            });
            await subscription.unsubscribe();
            console.log("Successfully unsubscribed.");
          }
        } catch (error) {
          console.error("Error during push notification unsubscribe:", error);
          toast({
            variant: "destructive",
            title: "Logout Warning",
            description: "Could not unsubscribe from push notifications. You may receive notifications for the wrong account. Please clear site data if issues persist."
          });
        }
      }
    };
    await unsubscribe();
    logout();
    setIsSheetOpen(false);
  };
  
  if (!isClient || !currentUser) {
      return (
          <div className="flex min-h-screen w-full bg-muted/40">
             <div className="flex-1 flex flex-col">
                  <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background px-4 sm:px-6">
                     {/* Skeleton Header */}
                  </header>
                  <main className="flex-1 overflow-y-auto p-4 md:p-6">
                      <div className="flex justify-center items-center h-[calc(100vh-56px)]">
                         <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                 </main>
             </div>
         </div>
      );
  }

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      <div className="flex-1 flex flex-col">
           <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background px-4 sm:px-6">
             <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-base sm:text-lg text-primary">
                <Image src="/msarch-logo.png" alt="Msarch App Logo" width={24} height={24} className="h-5 w-5 sm:h-6 sm:w-6" priority />
                 <span className="hidden sm:inline">{layoutDict.appTitle}</span>
                 <span className="sm:hidden">{layoutDict.appTitleShort || layoutDict.appTitle}</span>
              </Link>

             <div className="flex items-center gap-2">
              <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="relative h-9 w-9 sm:h-10 sm:w-10">
                        <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                       {isClient && unreadCount > 0 && (
                          <Badge
                             variant="destructive"
                              className="absolute -top-1 -right-1 h-4 w-4 p-0 justify-center text-[10px] sm:text-xs"
                           >
                             {unreadCount > 9 ? '9+' : unreadCount}
                           </Badge>
                       )}
                        <span className="sr-only">
                          {notificationsDict.tooltip}
                        </span>
                   </Button>
                </PopoverTrigger>
                 <PopoverContent className="w-80 p-0">
                  <div className="p-4 border-b">
                      <h4 className="font-medium leading-none">{notificationsDict.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {notificationsDict.description}
                      </p>
                  </div>
                   <div className="max-h-60 overflow-y-auto">
                   {isClient && notifications.length > 0 ? (
                       notifications.map(notification => (
                         <div
                             key={notification.id}
                             onClick={() => handleNotificationClick(notification)}
                             className={cn(
                                 "p-3 flex items-start gap-3 hover:bg-accent cursor-pointer border-b last:border-b-0",
                                 !notification.isRead && "bg-secondary/50 hover:bg-secondary/70"
                             )}
                         >
                           <div className={cn(
                             "mt-1 h-2 w-2 rounded-full flex-shrink-0",
                             notification.isRead ? "bg-muted-foreground/30" : "bg-primary"
                           )}></div>
                           <div className="flex-1">
                               <p className="text-sm">{notification.message}</p>
                              <p className="text-xs text-muted-foreground">{formatTimestamp(notification.timestamp)}</p>
                           </div>
                         </div>
                       ))
                   ) : isClient ? ( 
                     <div className="p-4 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                       <MessageSquareWarning className="h-6 w-6" />
                       {notificationsDict.empty}
                     </div>
                   ) : null }
                 </div>
                </PopoverContent>
              </Popover>

              <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                   <Button variant="outline" size="icon" className="h-9 w-9 sm:h-10 sm:w-10">
                     <PanelRightOpen className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="sr-only">{layoutDict.toggleMenu}</span>
                  </Button>
                </SheetTrigger>
                 <SheetContent side="right" className="bg-primary text-primary-foreground border-primary-foreground/20 w-[80vw] max-w-[300px] sm:max-w-[320px] flex flex-col p-4">
                  <SheetHeader className="mb-4 text-left">
                     <SheetTitle className="text-primary-foreground text-lg sm:text-xl">{layoutDict.menuTitle}</SheetTitle>
                    <SheetDescription className="text-primary-foreground/80">
                     {layoutDict.menuDescription}
                    </SheetDescription>
                  </SheetHeader>

                   <nav className="flex-1 space-y-2 overflow-y-auto">
                     {isClient && currentUser && layoutDict ? (
                         visibleMenuItems.map((item) => (
                           <Link
                             key={item.href}
                             href={item.href}
                             onClick={() => setIsSheetOpen(false)}
                             className="flex items-center gap-3 rounded-md px-3 py-2 text-primary-foreground/90 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
                           >
                             <item.icon className="h-5 w-5" />
                             <span>{layoutDict[item.labelKey]}</span>
                           </Link>
                         ))
                     ) : (
                         <div className="space-y-2">
                           {[...Array(6)].map((_, i) => (
                               <div key={i} className="flex items-center gap-3 rounded-md px-3 py-2">
                                   <Skeleton className="h-5 w-5 rounded-full bg-primary-foreground/20" />
                                   <Skeleton className="h-4 w-32 bg-primary-foreground/20" />
                               </div>
                           ))}
                         </div>
                     )}
                   </nav>

                   <Separator className="my-4 bg-primary-foreground/20" />

                   <div className="mt-auto space-y-4">
                     {isClient && currentUser ? (
                       <div className="flex items-center gap-3 rounded-md p-2">
                         <Avatar className="h-10 w-10 border-2 border-primary-foreground/30">
                           <AvatarImage key={avatarKey} src={`${API_BASE_URL}/api/users/${currentUser.id}/avatar?v=${avatarKey}`} alt={currentUser.displayName || currentUser.username} />
                           <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground">
                               {getUserInitials(currentUser.displayName || currentUser.username)}
                           </AvatarFallback>
                         </Avatar>
                         <div className="flex flex-col overflow-hidden">
                           <span className="text-sm font-medium truncate text-primary-foreground">{currentUser.displayName || currentUser.username}</span>
                           <span className="text-xs text-primary-foreground/70 truncate flex items-center gap-1">
                             <RoleIcon className="h-3 w-3 flex-shrink-0" />
                             {getTranslatedRole(currentUser.roles)}
                           </span>
                         </div>
                       </div>
                     ) : (
                          <div className="flex items-center gap-3 rounded-md p-2">
                                <Skeleton className="h-10 w-10 rounded-full bg-primary-foreground/20" />
                                <div className="flex flex-col space-y-1">
                                     <Skeleton className="h-4 w-24 bg-primary-foreground/20" />
                                     <Skeleton className="h-3 w-16 bg-primary-foreground/20" />
                                </div>
                          </div>
                     )}


                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 text-primary-foreground/90 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                      onClick={handleLogout}
                      disabled={!isClient || !currentUser}
                    >
                      <LogOut className="h-5 w-5" />
                      <span>{layoutDict.logout}</span>
                    </Button>
                   </div>
                </SheetContent>
              </Sheet>
            </div>
          </header>


           <main className="flex-1 overflow-y-auto p-4 md:p-6">
             {isClient && currentUser ? children : (
                   <div className="flex justify-center items-center h-[calc(100vh-56px)]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
              )}
          </main>
      </div>
    </div>
  );
}
