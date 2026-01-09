// src/services/notification-service.ts
'use server';

import * as path from 'path';
import webPush, { type PushSubscription } from 'web-push';
import { readDb, writeDb } from '../lib/database-utils';
import { getAllUsers, getSubscriptionsForUserIds } from './data-access/user-data';

const DB_BASE_PATH = process.env.DATABASE_PATH || path.resolve(process.cwd());
const DB_PATH_NOTIFICATIONS = path.join(DB_BASE_PATH, 'database', 'notifications.json');
const DB_PATH_SUBSCRIPTIONS = path.join(DB_BASE_PATH, 'database', 'subscriptions.json');

export interface Notification {
    id: string;
    userId: string;
    projectId?: string;
    message: string;
    timestamp: string;
    isRead: boolean;
    url?: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
}

interface StoredSubscription {
  userId: string;
  subscription: PushSubscription;
}

const NOTIFICATION_LIMIT = 300;

// Initialize VAPID details once
if (process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    try {
        webPush.setVapidDetails(
            process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );
        console.log("[NotificationService] VAPID keys loaded successfully.");
    } catch (error) {
        console.error("[NotificationService] CRITICAL: Failed to load VAPID keys.", error);
    }
} else {
    console.warn("[NotificationService] VAPID keys are not configured. Push notifications will be disabled.");
}

async function sendPushNotification(subscription: PushSubscription, payload: NotificationPayload) {
    try {
        const payloadString = JSON.stringify(payload);
        await webPush.sendNotification(subscription, payloadString);
        console.log(`[NotificationService] Push notification sent successfully to endpoint: ${subscription.endpoint.slice(0, 50)}...`);
    } catch (error: any) {
        console.error(`[NotificationService] Failed to send push notification. Status: ${error.statusCode}, Message: ${error.body || error.message}`);
        if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(`[NotificationService] Subscription has expired or is no longer valid. Deleting...`);
            await deleteSubscription(subscription);
        }
    }
}

async function addInAppNotifications(userIds: string[], payload: NotificationPayload, projectId?: string): Promise<void> {
    const notifications = await readDb<Notification[]>(DB_PATH_NOTIFICATIONS, []);
    const now = new Date().toISOString();

    for (const userId of userIds) {
        const newNotification: Notification = {
            id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            userId: userId,
            projectId: projectId,
            message: payload.body,
            url: payload.url,
            timestamp: now,
            isRead: false,
        };
        notifications.unshift(newNotification);
    }
    
    if (notifications.length > NOTIFICATION_LIMIT) {
        notifications.splice(NOTIFICATION_LIMIT);
    }
    
    await writeDb(DB_PATH_NOTIFICATIONS, notifications);
}

async function findUsersByRole(rolesToFind: string[]): Promise<string[]> {
    const allUsers = await getAllUsers();
    const normalizedRolesToFind = rolesToFind.map(r => r.trim().toLowerCase());

    const userIds = allUsers
        .filter(user => 
            user.roles && Array.isArray(user.roles) &&
            user.roles.some(userRole => normalizedRolesToFind.includes(userRole.trim().toLowerCase()))
        )
        .map(user => user.id);

    console.log(`[NotificationService] Roles to find: [${normalizedRolesToFind.join(', ')}]. Found ${userIds.length} user(s).`);
    return userIds;
}

export async function notifyUsersByRole(roles: string | string[], payload: NotificationPayload, projectId?: string): Promise<void> {
    const rolesArray = Array.isArray(roles) ? roles : [roles];
    console.log(`[NotificationService] Preparing to notify roles: ${JSON.stringify(rolesArray)}`);

    const userIdsToNotify = await findUsersByRole(rolesArray);

    if (userIdsToNotify.length === 0) {
        console.warn(`[NotificationService] No users found for role(s): ${rolesArray.join(', ')}. Aborting notification.`);
        return;
    }
    
    await addInAppNotifications(userIdsToNotify, payload, projectId);
    
    if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        console.log("[NotificationService] Skipping push notifications because VAPID keys are not set.");
        return;
    }

    const targetSubscriptions = await getSubscriptionsForUserIds(userIdsToNotify);

    for (const sub of targetSubscriptions) {
        console.log(`[NotificationService] Sending to subscription for user ${sub.userId}.`);
        await sendPushNotification(sub.subscription, payload);
    }
}

export async function notifyUserById(userId: string, payload: NotificationPayload, projectId?: string): Promise<void> {
    if (!userId) return;
    const userIdsToNotify = [userId];

    if (userIdsToNotify.length === 0) {
        console.warn(`[NotificationService] No users found for ID: ${userId}. Aborting notification.`);
        return;
    }
    
    await addInAppNotifications(userIdsToNotify, payload, projectId);
    
    if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        console.log("[NotificationService] Skipping push notifications because VAPID keys are not set.");
        return;
    }

    const userSubscriptions = await getSubscriptionsForUserIds(userIdsToNotify);

    if (userSubscriptions.length > 0) {
        console.log(`[NotificationService] Found ${userSubscriptions.length} subscription(s) for user ${userId}.`);
        await Promise.all(
            userSubscriptions.map(sub => sendPushNotification(sub.subscription, payload))
        );
    } else {
         console.log(`[NotificationService] No push subscriptions found for user ${userId}.`);
    }
}

export async function getNotificationsForUser(userId: string): Promise<Notification[]> {
    const allNotifications = await readDb<Notification[]>(DB_PATH_NOTIFICATIONS, []);
    return allNotifications.filter(n => n.userId === userId).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
    const notifications = await readDb<Notification[]>(DB_PATH_NOTIFICATIONS, []);
    const notificationIndex = notifications.findIndex(n => n.id === notificationId);

    if (notificationIndex !== -1 && !notifications[notificationIndex].isRead) {
        notifications[notificationIndex].isRead = true;
        await writeDb(DB_PATH_NOTIFICATIONS, notifications);
    }
}

export async function deleteNotificationsByProjectId(projectId: string): Promise<void> {
    if (!projectId) return;
    const notifications = await readDb<Notification[]>(DB_PATH_NOTIFICATIONS, []);
    const filtered = notifications.filter(n => n.projectId !== projectId);
    if (notifications.length !== filtered.length) {
        await writeDb(DB_PATH_NOTIFICATIONS, filtered);
    }
}

export async function clearAllNotifications(): Promise<void> {
    await writeDb(DB_PATH_NOTIFICATIONS, []);
}

export async function saveSubscription(userId: string, newSubscription: PushSubscription): Promise<void> {
    const allStoredSubscriptions = await readDb<StoredSubscription[]>(DB_PATH_SUBSCRIPTIONS, []);
    
    const subscriptionExists = allStoredSubscriptions.some(
        s => s.userId === userId && s.subscription.endpoint === newSubscription.endpoint
    );

    if (!subscriptionExists) {
        const newStoredSub: StoredSubscription = { userId, subscription: newSubscription };
        allStoredSubscriptions.push(newStoredSub);
        await writeDb(DB_PATH_SUBSCRIPTIONS, allStoredSubscriptions);
        console.log(`[NotificationService] Subscription saved for user ${userId}. Total subscriptions for user: ${allStoredSubscriptions.filter(s => s.userId === userId).length}.`);
    } else {
        console.log(`[NotificationService] Subscription with endpoint ${newSubscription.endpoint.slice(0,50)}... already exists for user ${userId}.`);
    }
}

export async function deleteSubscription(subscriptionToDelete: PushSubscription): Promise<void> {
    const allStoredSubscriptions = await readDb<StoredSubscription[]>(DB_PATH_SUBSCRIPTIONS, []);
    
    const updatedSubscriptions = allStoredSubscriptions.filter(
        s => s.subscription.endpoint !== subscriptionToDelete.endpoint
    );

    if (allStoredSubscriptions.length !== updatedSubscriptions.length) {
      await writeDb(DB_PATH_SUBSCRIPTIONS, updatedSubscriptions);
      console.log(`[NotificationService] Subscription with endpoint ${subscriptionToDelete.endpoint.slice(0, 50)}... has been deleted.`);
    }
}
