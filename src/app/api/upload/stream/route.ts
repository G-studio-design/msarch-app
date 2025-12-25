// src/app/api/upload/stream/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';
import fs from 'fs';
import { sanitizeForPath } from '@/lib/path-utils';
import { addFilesToProject } from '@/services/project-service';

const pump = promisify(pipeline);

const DB_BASE_PATH = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'database');
const PROJECT_FILES_BASE_DIR = path.join(DB_BASE_PATH, 'project_files');

export const maxDuration = 300; // 5-minute timeout for large file uploads

async function ensureDirectoryExists(directoryPath: string) {
  try {
    await fs.promises.stat(directoryPath);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      await fs.promises.mkdir(directoryPath, { recursive: true });
    } else {
      throw error;
    }
  }
}

export async function POST(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const originalFilename = searchParams.get('filename');
  const projectId = searchParams.get('projectId');
  const userId = searchParams.get('userId');
  const uploaderRole = searchParams.get('uploaderRole');
  const note = searchParams.get('note');
  const associatedChecklistItem = searchParams.get('associatedChecklistItem');

  if (!originalFilename || !projectId || !userId || !uploaderRole) {
    return NextResponse.json({ message: 'Missing required query parameters (filename, projectId, userId, uploaderRole).' }, { status: 400 });
  }

  if (!req.body) {
    return NextResponse.json({ message: 'No file stream found in request body.' }, { status: 400 });
  }

  try {
    const sanitizedItemName = associatedChecklistItem ? sanitizeForPath(associatedChecklistItem).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : '';
    const safeFilenameForPath = `${sanitizedItemName ? `${sanitizedItemName}_` : ''}${sanitizeForPath(originalFilename) || `unnamed_${Date.now()}`}`;

    const projectSpecificDir = path.join(PROJECT_FILES_BASE_DIR, projectId);
    await ensureDirectoryExists(projectSpecificDir);

    const relativePath = path.join(projectId, safeFilenameForPath).replace(/\\/g, '/');
    const absoluteFilePath = path.join(projectSpecificDir, safeFilenameForPath);

    // Stream the file directly to disk
    // @ts-ignore - req.body is a ReadableStream
    await pump(req.body, fs.createWriteStream(absoluteFilePath));

    console.log(`[API/UploadStream] Successfully streamed file to: ${absoluteFilePath}`);

    const fileEntry = {
      name: originalFilename,
      path: relativePath,
      uploadedBy: uploaderRole,
    };

    // After the file is successfully on disk, update the project's JSON database
    await addFilesToProject(projectId, [fileEntry], userId, note || `File uploaded: ${originalFilename}`);

    return NextResponse.json({
        message: 'File uploaded successfully via streaming',
        ...fileEntry
    });

  } catch (error: any) {
    console.error(`[API/UploadStream] Error during file streaming:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload file via stream';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
