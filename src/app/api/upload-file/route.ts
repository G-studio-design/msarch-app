// src/app/api/upload-file/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, stat, mkdir } from 'fs/promises';
import path from 'path';
import { sanitizeForPath } from '@/lib/path-utils';
import { addFilesToProject } from '@/services/project-service';

// Increase the timeout for this specific route to 5 minutes (300 seconds)
export const maxDuration = 300;

const DB_BASE_PATH = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'database');
const PROJECT_FILES_BASE_DIR = path.join(DB_BASE_PATH, 'project_files');

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
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;
    const userId = formData.get('userId') as string | null;
    const uploaderRole = formData.get('uploaderRole') as string | null;
    const note = formData.get('note') as string | null;
    const associatedChecklistItem = formData.get('associatedChecklistItem') as string | null;

    if (!file || !projectId || !userId || !uploaderRole) {
      return NextResponse.json({ message: 'Missing required form data.' }, { status: 400 });
    }

    const sanitizedItemName = associatedChecklistItem ? sanitizeForPath(associatedChecklistItem).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : '';
    const safeFilenameForPath = `${sanitizedItemName ? `${sanitizedItemName}_` : ''}${sanitizeForPath(file.name) || `unnamed_${Date.now()}`}`;

    const projectSpecificDir = path.join(PROJECT_FILES_BASE_DIR, projectId);
    await ensureDirectoryExists(projectSpecificDir);
    
    const relativePath = path.join(projectId, safeFilenameForPath).replace(/\\/g, '/');
    const absoluteFilePath = path.join(projectSpecificDir, safeFilenameForPath);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(absoluteFilePath, buffer);

    console.log(`[API/UploadFile] Successfully wrote file to: ${absoluteFilePath}`);

    const fileEntry = {
      name: file.name,
      path: relativePath,
      uploadedBy: uploaderRole,
    };
    
    await addFilesToProject(projectId, [fileEntry], userId, note || `File uploaded: ${file.name}`);

    return NextResponse.json({
        message: 'File uploaded successfully',
        ...fileEntry
    });

  } catch (error) {
    console.error(`[API/UploadFile] Error during file upload:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload file';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
