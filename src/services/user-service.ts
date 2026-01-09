// src/services/user-service.ts
'use server';

import * as path from 'path';
import * as fs from 'fs/promises';
import type { User, AddUserData, UpdateProfileData, UpdatePasswordData, UpdateUserGoogleTokensData } from '../types/user-types';
import { readDb, writeDb } from '../lib/database-utils';

// KOMENTAR SEMENTARA:
// Variabel `DATABASE_PATH` ini diambil dari `docker-compose.yml` (environment: - DATABASE_PATH=/app/data).
// Sehingga, path ini akan menunjuk ke `/app/data/database/users.json` di dalam container,
// yang terhubung langsung ke `msarch-data/database/users.json` di NAS Anda.
const DB_BASE_PATH = process.env.DATABASE_PATH || path.resolve(process.cwd());
const DB_PATH_USERS = path.join(DB_BASE_PATH, 'database', 'users.json');
const AVATAR_UPLOAD_DIR = path.join(DB_BASE_PATH, 'database', 'uploads', 'avatars');


async function getAllUsers(): Promise<User[]> {
    return await readDb<User[]>(DB_PATH_USERS, []);
}

export async function findUserByUsername(username: string): Promise<User | null> {
    if (!username) return null;
    const users = await getAllUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    return user || null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
    if (!email) return null;
    const users = await getAllUsers();
    const user = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    return user || null;
}

export async function findUserById(userId: string): Promise<User | null> {
    if(!userId) return null;
    const users = await getAllUsers();
    const user = users.find(u => u.id === userId);
    return user || null;
}

export async function verifyUserCredentials(usernameInput: string, passwordInput: string): Promise<Omit<User, 'password'> | null> {
    if (!usernameInput || !passwordInput) return null;
    const user = await findUserByUsername(usernameInput);

    if (!user || !user.password) {
        console.log(`[Auth] User '${usernameInput}' not found or has no password.`);
        return null;
    }

    const isMatch = passwordInput === user.password;

    if (!isMatch) {
        console.log(`[Auth] Password mismatch for user '${usernameInput}'.`);
        return null;
    }
    
    console.log(`[Auth] User '${usernameInput}' authenticated successfully.`);
    const { password: _p, ...userWithoutPassword } = user;
    return userWithoutPassword;
}

export async function addUser(userData: AddUserData): Promise<Omit<User, 'password'>> {
    const users = await getAllUsers();

    if (userData.roles.includes('Admin Developer')) {
        throw new Error('INVALID_ROLE_CREATION_ATTEMPT');
    }

    if (users.some(u => u.username.toLowerCase() === userData.username.toLowerCase())) {
        throw new Error('USERNAME_EXISTS');
    }
    if (userData.email && users.some(u => u.email && u.email.toLowerCase() === userData.email!.toLowerCase())) {
        throw new Error('EMAIL_EXISTS');
    }

    const newUser: User = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        username: userData.username,
        password: userData.password, // Store plain text password
        roles: userData.roles,
        email: userData.email || `${userData.username.toLowerCase().replace(/\s+/g, '_')}@example.com`,
        displayName: userData.displayName || userData.username,
        createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    await writeDb(DB_PATH_USERS, users);
    const { password: _p, ...newUserWithoutPassword } = newUser;
    return newUserWithoutPassword;
}

export async function deleteUser(userId: string): Promise<void> {
    let users = await getAllUsers();
    const userToDelete = users.find(user => user.id === userId);

    if (!userToDelete) {
        throw new Error('USER_NOT_FOUND');
    }
    
    // Clean up avatar file if it exists
    if (userToDelete.profilePictureUrl) {
        const oldAvatarPath = path.join(AVATAR_UPLOAD_DIR, path.basename(userToDelete.profilePictureUrl));
        try {
            await fs.unlink(oldAvatarPath);
            console.log(`[UserService/deleteUser] Cleaned up avatar for deleted user ${userId}: ${oldAvatarPath}`);
        } catch (error: any) {
            if (error.code !== 'ENOENT') { // Don't log error if file simply doesn't exist
                console.warn(`[UserService/deleteUser] Could not clean up avatar for user ${userId}:`, error.message);
            }
        }
    }


    if (userToDelete.roles.includes('Admin Developer')) {
        throw new Error('CANNOT_DELETE_ADMIN_DEVELOPER');
    }

    const remainingUsers = users.filter(user => user.id !== userId);
    await writeDb(DB_PATH_USERS, remainingUsers);
}

export async function updateUserProfile(updateData: UpdateProfileData): Promise<Omit<User, 'password'>> {
    let users = await getAllUsers();
    const userIndex = users.findIndex(u => u.id === updateData.userId);

    if (userIndex === -1) {
        throw new Error('USER_NOT_FOUND');
    }

    const currentUserState = users[userIndex];

    // Prevent assigning 'Admin Developer' role
    if (updateData.roles && updateData.roles.includes('Admin Developer')) {
        throw new Error('CANNOT_SET_ADMIN_DEVELOPER_ROLE');
    }
    // Prevent removing 'Admin Developer' role from an existing admin dev
    if (currentUserState.roles.includes('Admin Developer') && updateData.roles && !updateData.roles.includes('Admin Developer')) {
        throw new Error('CANNOT_CHANGE_ADMIN_DEVELOPER_ROLE');
    }

    if (updateData.username && updateData.username.toLowerCase() !== currentUserState.username.toLowerCase()) {
        if (users.some(u => u.id !== updateData.userId && u.username.toLowerCase() === updateData.username!.toLowerCase())) {
            throw new Error('USERNAME_EXISTS');
        }
    }
    if (updateData.email && updateData.email.toLowerCase() !== (currentUserState.email || '').toLowerCase()) {
        if (users.some(u => u.id !== updateData.userId && u.email && u.email.toLowerCase() === updateData.email!.toLowerCase())) {
            throw new Error('EMAIL_EXISTS');
        }
    }
    
    const updatedUser = { ...currentUserState, ...updateData };
    users[userIndex] = updatedUser;
    await writeDb(DB_PATH_USERS, users);
    
    const { password: _p, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
}

export async function updatePassword(updateData: UpdatePasswordData): Promise<void> {
    let users = await getAllUsers();
    const userIndex = users.findIndex(u => u.id === updateData.userId);

    if (userIndex === -1) {
        throw new Error('USER_NOT_FOUND');
    }

    const user = users[userIndex];

    if (updateData.currentPassword) {
        if (!user.password) {
            throw new Error('PASSWORD_MISMATCH');
        }
        const isMatch = updateData.currentPassword === user.password;
        if (!isMatch) {
            throw new Error('PASSWORD_MISMATCH');
        }
    }
    
    users[userIndex].password = updateData.newPassword;
    await writeDb(DB_PATH_USERS, users);
}

export async function getAllUsersForDisplay(): Promise<Omit<User, 'password'>[]> {
    const users = await getAllUsers();
    return users.map(user => {
            const { password: _p, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });
}

export async function updateUserGoogleTokens(
    userId: string,
    tokens: UpdateUserGoogleTokensData
): Promise<void> {
    let users = await getAllUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        throw new Error('USER_NOT_FOUND');
    }

    users[userIndex] = {
        ...users[userIndex],
        googleRefreshToken: tokens.refreshToken !== undefined ? tokens.refreshToken : users[userIndex].googleRefreshToken,
        googleAccessToken: tokens.accessToken !== undefined ? tokens.accessToken : users[userIndex].googleAccessToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt !== undefined ? tokens.accessTokenExpiresAt : users[userIndex].accessTokenExpiresAt,
    };
    
    await writeDb(DB_PATH_USERS, users);
}

export async function clearUserGoogleTokens(userId: string): Promise<Omit<User, 'password'>> {
    let users = await getAllUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        throw new Error('USER_NOT_FOUND');
    }

    const user = { ...users[userIndex] };
    
    delete user.googleRefreshToken;
    delete user.googleAccessToken;
    delete user.accessTokenExpiresAt;

    users[userIndex] = user;
    
    await writeDb(DB_PATH_USERS, users);
    const { password: _p, ...userWithoutPassword } = users[userIndex];
    return userWithoutPassword;
}

export async function updateUserProfilePicture(userId: string, newFilename: string): Promise<Omit<User, 'password'>> {
  let users = await getAllUsers();
  const userIndex = users.findIndex(u => u.id === userId);

  if (userIndex === -1) {
    throw new Error('USER_NOT_FOUND');
  }

  const oldFilename = users[userIndex].profilePictureUrl;

  // The URL stored in the DB is just the filename now
  const updatedUser: User = {
    ...users[userIndex],
    profilePictureUrl: newFilename,
  };

  users[userIndex] = updatedUser;
  await writeDb(DB_PATH_USERS, users);

  // Clean up the old file
  if (oldFilename) {
    const oldAbsolutePath = path.join(AVATAR_UPLOAD_DIR, oldFilename);
    try {
      await fs.unlink(oldAbsolutePath);
      console.log(`[UserService] Successfully deleted old avatar: ${oldAbsolutePath}`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.warn(`[UserService] Could not delete old avatar file ${oldAbsolutePath}:`, error.message);
      }
    }
  }

  const { password, ...userWithoutPassword } = updatedUser;
  return userWithoutPassword;
}
