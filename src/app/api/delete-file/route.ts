// src/app/api/delete-file/route.ts
import { NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { deleteProjectFile as deleteFileRecordService, getProjectById } from '@/services/project-service';
import { findUserById } from '@/services/user-service';

const DB_BASE_PATH = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'database');
const PROJECT_FILES_BASE_DIR = path.join(DB_BASE_PATH, 'project_files');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, filePath, userId } = body as { projectId: string; filePath: string; userId: string; };

    if (!projectId || !filePath || !userId) {
      return NextResponse.json({ message: 'Project ID, file path, and user ID are required.' }, { status: 400 });
    }

    const user = await findUserById(userId);
    if (!user || !user.roles) {
      // Allow system action for automatic revision deletion
      if (userId !== 'system-revision') {
          return NextResponse.json({ message: 'User not found or has no roles assigned.' }, { status: 404 });
      }
    }

    const project = await getProjectById(projectId);
    if (!project) {
        return NextResponse.json({ message: 'Project not found.' }, { status: 404 });
    }

    const fileToDelete = project.files.find(f => f.path === filePath);
    if (!fileToDelete) {
        return NextResponse.json({ message: 'File record not found in project data.' }, { status: 404 });
    }
    
    // Authorization Check: Allow if it's a system revision action or if user has permission
    let canDelete = userId === 'system-revision';
    if (!canDelete && user) {
        const ALLOWED_ROLES_TO_DELETE = ['Owner', 'Admin Proyek', 'Admin Developer'];
        canDelete = user.roles.some(role => ALLOWED_ROLES_TO_DELETE.includes(role)) || user.roles.includes(fileToDelete.uploadedBy);
    }
    
    if (!canDelete) {
        return NextResponse.json({ message: 'You are not authorized to delete this file.' }, { status: 403 });
    }

    // Call the centralized service function to delete the file record and physical file.
    // The service function now contains the logic for physical deletion.
    await deleteFileRecordService(projectId, filePath, user?.username || 'system');

    return NextResponse.json({ message: 'File deleted successfully.' }, { status: 200 });

  } catch (error: any) {
    console.error('[API/DeleteFile] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during file deletion.';
    return NextResponse.json({ message: `File deletion failed: ${errorMessage}` }, { status: 500 });
  }
}
