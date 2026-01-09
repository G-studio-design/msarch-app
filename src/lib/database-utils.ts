// src/lib/database-utils.ts
'use server';

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Safely reads a JSON database file, ensuring it always gets the latest version from disk.
 * This function is designed for a server environment where data files can be updated.
 * @param dbPath The absolute path to the database file.
 * @param defaultData The default data to return if the file doesn't exist or is empty.
 * @returns A promise that resolves to the parsed data or the default data.
 */
export async function readDb<T>(dbPath: string, defaultData: T): Promise<T> {
    try {
        // ALWAYS read the file from disk, do not use any in-memory cache.
        const data = await fs.readFile(dbPath, 'utf8');
        
        // If file is empty, it's invalid JSON. Return default data.
        if (data.trim() === "") {
            console.warn(`[DB Read] DB file at ${path.basename(dbPath)} was empty. Returning default data.`);
            return defaultData;
        }

        return JSON.parse(data) as T;

    } catch (error: any) {
        // If file does not exist, return default data but DO NOT create it.
        if (error.code === 'ENOENT') {
            console.error(`[DB Read] CRITICAL: DB file at ${dbPath} not found. Returning default data. Make sure the file exists.`);
            return defaultData;
        }
        
        // For any other error (e.g., malformed JSON), log it and return default.
        // This prevents a crash if the file becomes corrupted.
        console.error(`[DB Read] Error reading or parsing ${path.basename(dbPath)}: ${error.message}. Returning default data as a fallback.`);
        return defaultData;
    }
}

/**
 * Writes data to a JSON database file, creating the directory if it doesn't exist.
 * @param dbPath The absolute path to the database file.
 * @param data The data to write to the file.
 */
export async function writeDb<T>(dbPath: string, data: T): Promise<void> {
    try {
        const dbDir = path.dirname(dbPath);
        await fs.mkdir(dbDir, { recursive: true });
        // Use a temporary file and rename for atomic write
        const tempFilePath = dbPath + '.tmp';
        await fs.writeFile(tempFilePath, JSON.stringify(data, null, 2), 'utf8');
        await fs.rename(tempFilePath, dbPath);
    } catch (error: any) {
        console.error(`[DB Write] CRITICAL: Failed to write to DB file at ${path.basename(dbPath)}. Error: ${error.message}`);
        // If there was a temp file, try to clean it up
        try {
            await fs.unlink(dbPath + '.tmp');
        } catch (cleanupError) {
            // Ignore cleanup error
        }
        throw error; // Re-throw the original error
    }
}
