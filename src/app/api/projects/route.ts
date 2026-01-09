// src/app/api/projects/route.ts
'use server';

import { NextResponse } from 'next/server';
import { addProject, getAllProjects, addFilesToProject, getProjectById, deleteProject } from '@/services/project-service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { sanitizeForPath } from '@/lib/path-utils';

const DB_BASE_PATH = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'database');
const PROJECT_FILES_BASE_DIR = path.join(DB_BASE_PATH, 'project_files');


export async function GET(request: Request) {
  try {
    const projects = await getAllProjects();
    return NextResponse.json(projects);
  } catch (error) {
    console.error('[API/Projects GET All] Error:', error);
    return NextResponse.json({ message: "Failed to fetch projects." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let newProjectId: string | null = null;

  try {
    const formData = await request.formData();
    const title = formData.get('title') as string | null;
    const workflowId = formData.get('workflowId') as string | null;
    const createdBy = formData.get('createdBy') as string | null;
    const userId = formData.get('userId') as string | null; // User ID from the form
    const files = formData.getAll('files') as File[];

    if (!title || !workflowId || !createdBy || !userId) {
      return NextResponse.json({ message: 'Missing required project data.' }, { status: 400 });
    }
    
    // Ensure the base project_files directory exists before any operation
    await fs.mkdir(PROJECT_FILES_BASE_DIR, { recursive: true });

    // 1. Create the project entry to get an ID
    const newProject = await addProject({ title, workflowId, createdBy });
    newProjectId = newProject.id; 

    // The project-specific directory is already created by addProject service

    // 2. Handle file uploads if any
    if (files.length > 0) {
        const projectSpecificDirAbsolute = path.join(PROJECT_FILES_BASE_DIR, newProjectId);
        // This directory should already exist from the service, but we ensure it just in case
        await fs.mkdir(projectSpecificDirAbsolute, { recursive: true });

        const fileEntries = [];
        for (const file of files) {
            const originalFilename = file.name;
            const safeFilenameForPath = sanitizeForPath(originalFilename) || `file_${Date.now()}`;
            const relativeFilePath = path.join(newProjectId, safeFilenameForPath);
            const absoluteFilePath = path.join(projectSpecificDirAbsolute, safeFilenameForPath);
            
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);
            await fs.writeFile(absoluteFilePath, buffer);

            fileEntries.push({
                name: originalFilename,
                path: relativeFilePath.replace(/\\/g, '/'),
                timestamp: new Date().toISOString(),
                uploadedBy: createdBy // Use the creator's username
            });
        }
        // 3. Update the project with the file metadata
        await addFilesToProject(newProjectId, fileEntries, createdBy);
    }
    
    // 4. Fetch the final state of the project to return
    const finalProject = await getProjectById(newProjectId);

    return NextResponse.json(finalProject, { status: 201 });

  } catch (error: any) {
    console.error('[API/Projects POST] Error:', error);
    
    // Rollback logic: If project entry was created but something failed after, delete the entry
    if (newProjectId) {
        try {
            await deleteProject(newProjectId, 'system-rollback');
            console.log(`[API/Projects POST Rollback] Deleted project ${newProjectId} due to creation error.`);
        } catch (rollbackError) {
            console.error(`[API/Projects POST Rollback] CRITICAL: Failed to delete project ${newProjectId} after an error. Manual cleanup required.`, rollbackError);
        }
    }

    let errorMessage = 'Failed to add project.';
    let statusCode = 500;
    if (error.message === 'WORKFLOW_INVALID') {
        errorMessage = 'Invalid workflow specified for project creation.';
        statusCode = 400;
    } else if (error.message) {
        errorMessage = error.message;
    }
    return NextResponse.json({ message: errorMessage }, { status: statusCode });
  }
}
