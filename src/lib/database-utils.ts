// src/lib/database-utils.ts
'use server';

import * as fs from 'fs/promises';
import * as path from 'path';

// In-memory cache to reduce disk I/O on the NAS
const cache = new Map<string, { data: any; mtime: number }>();
const CACHE_ENABLED = process.env.NODE_ENV === 'production'; // Only cache in production

async function getFileMtime(filePath: string): Promise<number> {
    try {
        const stats = await fs.stat(filePath);
        return stats.mtime.getTime();
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return 0; // File doesn't exist, no modification time
        }
        throw error;
    }
}

/**
 * Safely reads a JSON database file, using an in-memory cache in production
 * to reduce disk I/O on the NAS.
 * @param dbPath The absolute path to the database file.
 * @param defaultData The default data to return if the file doesn't exist or is empty.
 * @returns A promise that resolves to the parsed data or the default data.
 */
export async function readDb<T>(dbPath: string, defaultData: T): Promise<T> {
    if (CACHE_ENABLED) {
        const fileMtime = await getFileMtime(dbPath);
        const cached = cache.get(dbPath);

        if (cached && cached.mtime === fileMtime) {
            // Return from cache if modification time is the same
            return cached.data as T;
        }
    }

    try {
        const data = await fs.readFile(dbPath, 'utf8');
        
        if (data.trim() === "") {
            console.warn(`[DB Read] DB file at ${path.basename(dbPath)} was empty. Using default data.`);
            return defaultData;
        }

        const parsedData = JSON.parse(data) as T;

        if (CACHE_ENABLED) {
            const fileMtime = await getFileMtime(dbPath); // Re-check mtime after read
            cache.set(dbPath, { data: parsedData, mtime: fileMtime });
        }

        return parsedData;

    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.warn(`[DB Read] DB file at ${path.basename(dbPath)} not found. Using default data. The file will be created on next write.`);
            return defaultData;
        }
        
        console.error(`[DB Read] Error reading or parsing ${path.basename(dbPath)}: ${error.message}. Using default data as a fallback.`);
        return defaultData;
    }
}

/**
 * Writes data to a JSON database file and invalidates the cache for that file.
 * @param dbPath The absolute path to the database file.
 * @param data The data to write to the file.
 */
export async function writeDb<T>(dbPath: string, data: T): Promise<void> {
    try {
        const dbDir = path.dirname(dbPath);
        await fs.mkdir(dbDir, { recursive: true });
        
        const tempFilePath = dbPath + '.tmp';
        await fs.writeFile(tempFilePath, JSON.stringify(data, null, 2), 'utf8');
        await fs.rename(tempFilePath, dbPath);

        // Invalidate cache on write
        if (CACHE_ENABLED) {
            cache.delete(dbPath);
        }

    } catch (error: any) {
        console.error(`[DB Write] CRITICAL: Failed to write to DB file at ${path.basename(dbPath)}. Error: ${error.message}`);
        try {
            await fs.unlink(dbPath + '.tmp');
        } catch (cleanupError) {
            // Ignore cleanup error, the original error is more important
        }
        throw error;
    }
}

/**
 * Invalidates the cache for a specific database file.
 * Useful if the file is modified by an external process.
 * @param dbPath The absolute path to the database file to invalidate.
 */
export function invalidateCache(dbPath: string): void {
    if (CACHE_ENABLED) {
        cache.delete(dbPath);
        console.log(`[Cache] Invalidated cache for ${path.basename(dbPath)}`);
    }
}

/**
 * Clears the entire in-memory database cache.
 */
export function clearAllCache(): void {
    if (CACHE_ENABLED) {
        cache.clear();
        console.log("[Cache] All in-memory caches cleared.");
    }
}
