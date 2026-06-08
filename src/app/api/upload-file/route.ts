// src/app/api/upload-file/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { stat, mkdir, rename } from 'fs/promises';
import path from 'path';
import { addFilesToProject } from '@/services/project-service';

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
        tempPath,
        originalFilename
    } = body;
    
    if (!projectId || !userId || !uploaderRole || !tempPath || !originalFilename) {
      return NextResponse.json({ message: 'Missing required finalization data.' }, { status: 400 });
    }

    // Force unique prefix for physical file storage to prevent leakage
    const prefix = associatedChecklistItem || "";
    const ext = path.extname(originalFilename);
    const base = path.basename(originalFilename, ext).toLowerCase().replace(/[^a-z0-9]/g, '_');
    const safeOriginalName = base + ext.toLowerCase();

    // Physical prefixing on disk to isolate files
    const finalFilenameOnDisk = `${prefix}${safeOriginalName}`;

    const projectSpecificDir = path.join(PROJECT_FILES_BASE_DIR, projectId);
    await ensureDirectoryExists(projectSpecificDir);

    const tempFilePath = path.join(UPLOAD_TEMP_DIR, path.basename(tempPath));
    const finalFilePath = path.join(projectSpecificDir, finalFilenameOnDisk);
    
    await rename(tempFilePath, finalFilePath);

    const relativePath = `${projectId}/${finalFilenameOnDisk}`.replace(/\\/g, '/');
    const historyNote = `File diunggah untuk: "${prefix.replace(/___/g, ' ')}". ${note ? `Catatan: ${note}`: ''}`;
    
    const fileEntry = {
      name: originalFilename,
      path: relativePath,
      uploadedBy: uploaderRole,
    };
    
    await addFilesToProject(projectId, [fileEntry], userId, historyNote);

    return NextResponse.json({
        message: 'File successfully processed and locked to checklist',
        ...fileEntry
    });

  } catch (error) {
    console.error(`[API/UploadFile] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to finalize file upload.';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
