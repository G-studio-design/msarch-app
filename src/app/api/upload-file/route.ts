// src/app/api/upload-file/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, stat, mkdir, rename } from 'fs/promises';
import path from 'path';
import { sanitizeForPath } from '@/lib/path-utils';
import { addFilesToProject } from '@/services/project-service';

// Increase the timeout for this specific route to 5 minutes (300 seconds)
export const maxDuration = 300;

const DB_BASE_PATH = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'database');
const PROJECT_FILES_BASE_DIR = path.join(DB_BASE_PATH, 'project_files');
const UPLOAD_TEMP_DIR = path.join(DB_BASE_PATH, 'uploads', 'tmp');

async function ensureDirectoryExists(directoryPath: string) {
  try {
    await stat(directoryPath);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      await mkdir(directoryPath, { recursive: true });
    } else {
      throw error;
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
        projectId, 
        userId, 
        uploaderRole, 
        note, 
        associatedChecklistItem,
        tempPath,          // From chunked upload
        originalFilename   // From chunked upload
    } = body;
    
    if (!projectId || !userId || !uploaderRole || !tempPath || !originalFilename) {
      return NextResponse.json({ message: 'Missing required finalization data.' }, { status: 400 });
    }

    const sanitizedItemName = associatedChecklistItem ? sanitizeForPath(associatedChecklistItem).replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() : '';
    const safeFilenameForPath = `${sanitizedItemName ? `${sanitizedItemName}_` : ''}${sanitizeForPath(originalFilename) || `unnamed_${Date.now()}`}`;

    const projectSpecificDir = path.join(PROJECT_FILES_BASE_DIR, projectId);
    await ensureDirectoryExists(projectSpecificDir);

    const tempFilePath = path.join(UPLOAD_TEMP_DIR, path.basename(tempPath));
    const finalFilePath = path.join(projectSpecificDir, safeFilenameForPath);
    
    // Move the assembled file from the temp directory to the final project directory
    await rename(tempFilePath, finalFilePath);

    console.log(`[API/UploadFile] Successfully moved assembled file to: ${finalFilePath}`);
    
    const relativePath = path.join(projectId, safeFilenameForPath).replace(/\\/g, '/');
    const historyNote = `File uploaded for checklist item: "${associatedChecklistItem || 'General Upload'}". Original name: ${originalFilename}. ${note ? `Catatan: ${note}`: ''}`;
    
    const fileEntry = {
      name: originalFilename,
      path: relativePath,
      uploadedBy: uploaderRole,
    };
    
    await addFilesToProject(projectId, [fileEntry], userId, historyNote);

    return NextResponse.json({
        message: 'File assembled and moved successfully',
        ...fileEntry
    });

  } catch (error) {
    console.error(`[API/UploadFile] Error during file finalization:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to finalize file upload.';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
