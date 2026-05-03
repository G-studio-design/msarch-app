// src/app/api/upload-file/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { stat, mkdir, rename } from 'fs/promises';
import path from 'path';
import { sanitizeForPath } from '@/lib/path-utils';
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

    // Generate strict prefix using the same utility as the client matching logic
    // associatedChecklistItem will be e.g. "Arsitek_Gambar" or "final_Berita Acara"
    const prefix = associatedChecklistItem 
      ? sanitizeForPath(associatedChecklistItem) + "_" 
      : "";
    
    // Sanitize the actual filename too
    const ext = path.extname(originalFilename);
    const base = path.basename(originalFilename, ext);
    const safeOriginalName = sanitizeForPath(base) + ext.toLowerCase();

    const safeFilenameForPath = `${prefix}${safeOriginalName || `file_${Date.now()}`}`;

    const projectSpecificDir = path.join(PROJECT_FILES_BASE_DIR, projectId);
    await ensureDirectoryExists(projectSpecificDir);

    const tempFilePath = path.join(UPLOAD_TEMP_DIR, path.basename(tempPath));
    const finalFilePath = path.join(projectSpecificDir, safeFilenameForPath);
    
    await rename(tempFilePath, finalFilePath);

    const relativePath = `${projectId}/${safeFilenameForPath}`.replace(/\\/g, '/');
    const historyNote = `File diunggah untuk item: "${associatedChecklistItem || 'Umum'}". ${note ? `Catatan: ${note}`: ''}`;
    
    const fileEntry = {
      name: originalFilename,
      path: relativePath,
      uploadedBy: uploaderRole, // This is important for secondary filtering
    };
    
    await addFilesToProject(projectId, [fileEntry], userId, historyNote);

    return NextResponse.json({
        message: 'File successfully processed',
        ...fileEntry
    });

  } catch (error) {
    console.error(`[API/UploadFile] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to finalize file upload.';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
