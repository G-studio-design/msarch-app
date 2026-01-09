// src/services/project-service.ts
'use server';

import * as path from 'path';
import * as fs from 'fs/promises';
import { format, parseISO } from 'date-fns';
import { id as IndonesianLocale } from 'date-fns/locale';
import { notifyUsersByRole, deleteNotificationsByProjectId, type NotificationPayload } from './notification-service';
import { getWorkflowById, getFirstStep, getTransitionInfo } from './workflow-service';
import { DEFAULT_WORKFLOW_ID } from '../config/workflow-constants';
import type { Project, AddProjectData, UpdateProjectParams, FileEntry, ScheduleDetails, SurveyDetails, WorkflowHistoryEntry } from '../types/project-types';
import { readDb, writeDb } from '../lib/database-utils';

export type { Project, AddProjectData, UpdateProjectParams, FileEntry, ScheduleDetails, SurveyDetails, WorkflowHistoryEntry };

const DB_BASE_PATH = process.env.DATABASE_PATH || path.resolve(process.cwd());
const DB_PATH = path.join(DB_BASE_PATH, 'database', 'projects.json');
const PROJECT_FILES_BASE_DIR = path.join(DB_BASE_PATH, 'project_files');


export async function addProject(projectData: Omit<AddProjectData, 'initialFiles'>): Promise<Project> {
    const projects = await readDb<Project[]>(DB_PATH, []);
    const now = new Date().toISOString();
    const projectId = `project_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    const firstStep = await getFirstStep(projectData.workflowId);
    if (!firstStep) {
        throw new Error('WORKFLOW_INVALID');
    }
    
    // Ensure the base project_files directory exists before creating subdirectories
    await fs.mkdir(PROJECT_FILES_BASE_DIR, { recursive: true });

    const newProject: Project = {
        id: projectId,
        title: projectData.title,
        status: firstStep.status,
        progress: firstStep.progress,
        assignedDivision: firstStep.assignedDivision,
        nextAction: firstStep.nextActionDescription,
        workflowId: projectData.workflowId,
        workflowHistory: [
            { division: projectData.createdBy, action: `Created Project with workflow: ${projectData.workflowId}`, timestamp: now, note: `Project entry created.` },
            { division: 'System', action: `Assigned to ${firstStep.assignedDivision} for ${firstStep.nextActionDescription || 'initial step'}`, timestamp: now }
        ],
        files: [],
        createdAt: now,
        createdBy: projectData.createdBy,
    };

    projects.push(newProject);
    await writeDb(DB_PATH, projects);
    
    // Create the project-specific directory after the project is successfully in the DB
    const projectSpecificDir = path.join(PROJECT_FILES_BASE_DIR, projectId);
    await fs.mkdir(projectSpecificDir, { recursive: true });
    
    if (firstStep.assignedDivision) {
        const payload: NotificationPayload = {
            title: `Proyek Baru Ditugaskan: ${newProject.title}`,
            body: `Anda ditugaskan untuk langkah awal pada proyek baru "${newProject.title}". Tugas: ${firstStep.nextActionDescription || 'Langkah awal'}.`,
            url: `/dashboard/projects?projectId=${newProject.id}`
        };
        await notifyUsersByRole(firstStep.assignedDivision, payload, newProject.id);
    }

    return newProject;
}

export async function addFilesToProject(projectId: string, filesToAdd: Omit<FileEntry, 'timestamp'>[], actorUsername: string, note?: string): Promise<Project | null> {
    const projects = await readDb<Project[]>(DB_PATH, []);
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) {
        return null;
    }

    const now = new Date().toISOString();
    const filesWithTimestamp = filesToAdd.map(file => ({ ...file, timestamp: now }));

    const project = projects[projectIndex];
    project.files.push(...filesWithTimestamp);
    
    const historyNote = `File administrasi tambahan diunggah oleh ${actorUsername}.${note ? ` Catatan: ${note}` : ''}`;
    
    project.workflowHistory.push({
        division: actorUsername,
        action: `Uploaded additional file(s): ${filesToAdd.map(f => f.name).join(', ')}`,
        timestamp: now,
        note: historyNote
    });
    
    projects[projectIndex] = project;
    await writeDb(DB_PATH, projects);
    
    return project;
}


export async function getAllProjects(): Promise<Project[]> {
    const projects = await readDb<Project[]>(DB_PATH, []);
    projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return projects;
}

export async function getProjectById(projectId: string): Promise<Project | null> {
    const projects = await readDb<Project[]>(DB_PATH, []);
    const project = projects.find(p => p.id === projectId) || null;
    if (project) {
        project.files = project.files || [];
        project.workflowHistory = project.workflowHistory || [];
    }
    return project;
}

export async function updateProject(params: UpdateProjectParams): Promise<Project | null> {
    const { projectId, updaterRoles, updaterUsername, actionTaken, files: newFilesData = [], note, scheduleDetails, surveyDetails } = params;

    const projects = await readDb<Project[]>(DB_PATH, []);
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) throw new Error('PROJECT_NOT_FOUND');

    const currentProject = projects[projectIndex];
    currentProject.files = currentProject.files || [];
    currentProject.workflowHistory = currentProject.workflowHistory || [];
    const projectWorkflowId = currentProject.workflowId || DEFAULT_WORKFLOW_ID;
    
    const now = new Date().toISOString();
    const filesWithTimestamp = newFilesData.map(file => ({ ...file, timestamp: now }));
    
    const transitionInfo = await getTransitionInfo(projectWorkflowId, currentProject.status, currentProject.progress, actionTaken);

    let historyActionText = `${updaterUsername} (${updaterRoles.join(', ')}) ${actionTaken} for "${currentProject.nextAction || 'progress'}"`;
    if (actionTaken === 'scheduled' && scheduleDetails) {
        historyActionText = `${updaterUsername} (${updaterRoles.join(', ')}) scheduled Sidang on ${scheduleDetails.date} at ${scheduleDetails.time}`;
    } else if ((actionTaken === 'submitted' || actionTaken === 'reschedule_survey') && surveyDetails) {
        if (actionTaken === 'reschedule_survey') {
            historyActionText = `${updaterUsername} (${updaterRoles.join(', ')}) rescheduled Survey to ${surveyDetails.date} at ${surveyDetails.time}`;
        } else {
            historyActionText = `${updaterUsername} (${updaterRoles.join(', ')}) submitted Survey Details for ${surveyDetails.date} at ${surveyDetails.time}`;
        }
    } else if (actionTaken === 'approved') {
        historyActionText = `${updaterUsername} (${updaterRoles.join(', ')}) approved: ${currentProject.nextAction || 'current step'}`;
    } else if (actionTaken === 'rejected' && currentProject.status === 'Pending Approval' && currentProject.progress === 20) {
        historyActionText = `${updaterUsername} (${updaterRoles.join(', ')}) canceled project at offer stage: ${currentProject.nextAction || 'penawaran'}`;
    } else if (actionTaken === 'rejected') {
        historyActionText = `${updaterUsername} (${updaterRoles.join(', ')}) rejected: ${currentProject.nextAction || 'current step'}`;
    } else if (actionTaken === 'revise_offer') {
        historyActionText = `${updaterUsername} (${updaterRoles.join(', ')}) requested revision for offer: ${currentProject.nextAction || 'penawaran'}`;
    } else if (['completed', 'revise_after_sidang', 'canceled_after_sidang'].includes(actionTaken)) {
         historyActionText = `${updaterUsername} (${updaterRoles.join(', ')}) declared Sidang outcome as: ${actionTaken.replace(/_after_sidang|_offer/g, '').replace(/_/g, ' ')}`;
    } else if (actionTaken === 'revision_completed_and_finish') {
        historyActionText = `${updaterUsername} (${updaterRoles.join(', ')}) completed post-sidang revisions and moved to final documentation.`;
    }

    const newWorkflowHistoryEntry: WorkflowHistoryEntry = {
        division: updaterRoles.join(', '),
        action: historyActionText,
        timestamp: now,
        note: note,
    };

    currentProject.files.push(...filesWithTimestamp);
    currentProject.workflowHistory.push(newWorkflowHistoryEntry);

    // --- Special Notification Logic for Final Document Stage ---
    if (currentProject.status === 'Pending Final Documents' && actionTaken === 'submitted' && newFilesData.length > 0) {
        let targetRole: string | null = null;
        if (updaterRoles.includes('Admin Proyek')) {
            targetRole = 'Owner';
        } else if (updaterRoles.includes('Owner')) {
            targetRole = 'Admin Proyek';
        }
        
        if (targetRole) {
            const payload: NotificationPayload = {
                title: `Dokumen Akhir Diunggah: ${currentProject.title}`,
                body: `${updaterUsername} (${updaterRoles.join(', ')}) telah mengunggah dokumen baru untuk tahap akhir proyek.`,
                url: `/dashboard/projects?projectId=${projectId}`
            };
            await notifyUsersByRole(targetRole, payload, projectId);
        }
    }


    if (transitionInfo) {
        currentProject.status = transitionInfo.targetStatus;
        currentProject.assignedDivision = transitionInfo.targetAssignedDivision;
        currentProject.nextAction = transitionInfo.targetNextActionDescription;
        currentProject.progress = transitionInfo.targetProgress;
        
        if (transitionInfo.notification?.division) {
            let body = (transitionInfo.notification.message || "Proyek '{projectName}' diperbarui. Tugas baru Anda: {nextAction}.")
                .replace('{projectName}', currentProject.title)
                .replace('{newStatus}', currentProject.status)
                .replace('{actorUsername}', updaterUsername)
                .replace('{nextAction}', currentProject.nextAction || 'Tinjau proyek')
                .replace('{reasonNote}', note || '');
            if (body.includes('{surveyDate}') && surveyDetails?.date) {
                const formattedDate = format(parseISO(`${surveyDetails.date}T${surveyDetails.time || '00:00'}`), "EEEE, d MMMM yyyy 'pukul' HH:mm", { locale: IndonesianLocale });
                body = body.replace('{surveyDate}', formattedDate);
            }
            const payload: NotificationPayload = {
                title: `Proyek Diperbarui: ${currentProject.title}`,
                body: body,
                url: `/dashboard/projects?projectId=${projectId}`
            };
            await notifyUsersByRole(transitionInfo.notification.division, payload, projectId);
        }
    } else {
        console.warn(`[ProjectService] No transition found for action '${actionTaken}' from status '${currentProject.status}'. Only updating history and files.`);
    }

    if (scheduleDetails) currentProject.scheduleDetails = scheduleDetails;
    if (surveyDetails) currentProject.surveyDetails = surveyDetails;

    projects[projectIndex] = currentProject;
    await writeDb(DB_PATH, projects);
    return currentProject;
}

export async function updateProjectTitle(projectId: string, newTitle: string): Promise<void> {
    const projects = await readDb<Project[]>(DB_PATH, []);
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) throw new Error('PROJECT_NOT_FOUND');

    const oldTitle = projects[projectIndex].title;
    projects[projectIndex].title = newTitle;
    projects[projectIndex].workflowHistory.push({
        division: "Admin", // Generic admin action
        action: `Manually changed project title from "${oldTitle}" to "${newTitle}".`,
        timestamp: new Date().toISOString(),
    });
    await writeDb(DB_PATH, projects);
}

export async function deleteProjectFile(projectId: string, filePath: string, deleterUsername: string): Promise<void> {
    const projects = await readDb<Project[]>(DB_PATH, []);
    const projectIndex = projects.findIndex(p => p.id === projectId);

    if (projectIndex === -1) throw new Error('PROJECT_NOT_FOUND');

    const project = projects[projectIndex];
    const fileToDelete = project.files.find(f => f.path === filePath);
    
    if (!fileToDelete) {
        console.warn(`[ProjectService/deleteProjectFile] File record not found for path: ${filePath}. Skipping database update.`);
    } else {
        project.files = project.files.filter(file => file.path !== filePath);
        if (deleterUsername !== 'system-revision') {
            project.workflowHistory.push({
                division: deleterUsername,
                action: `Deleted file: "${fileToDelete.name}"`,
                timestamp: new Date().toISOString(),
            });
        }
        projects[projectIndex] = project;
        await writeDb(DB_PATH, projects);
    }
    
    // --- Physical file deletion ---
    const absoluteFilePath = path.join(PROJECT_FILES_BASE_DIR, filePath);
    try {
        await fs.access(absoluteFilePath); // Check if file exists
        await fs.unlink(absoluteFilePath);
        console.log(`[ProjectService/deleteProjectFile] Physically deleted file: ${absoluteFilePath}`);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.warn(`[ProjectService/deleteProjectFile] Physical file not found, skipping unlink: ${absoluteFilePath}`);
        } else {
            // Re-throw other errors to be caught by the API route
            console.error(`[ProjectService/deleteProjectFile] Error deleting physical file ${absoluteFilePath}:`, error);
            throw new Error(`Failed to delete physical file: ${error.message}`);
        }
    }
}


export async function deleteProject(projectId: string, deleterUsername: string): Promise<string> {
    const projects = await readDb<Project[]>(DB_PATH, []);
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) throw new Error('PROJECT_NOT_FOUND_FOR_DELETION');

    const projectTitle = projects[projectIndex].title;
    
    // Delete physical project files directory
    const projectFilesDir = path.join(PROJECT_FILES_BASE_DIR, projectId);
    try {
        await fs.rm(projectFilesDir, { recursive: true, force: true });
        console.log(`[ProjectService] Deleted project files directory: ${projectFilesDir}`);
    } catch (error) {
        console.error(`[ProjectService] Failed to delete project files directory ${projectFilesDir}. Manual cleanup may be required.`, error);
    }
    
    const remainingProjects = projects.filter(p => p.id !== projectId);
    await writeDb(DB_PATH, remainingProjects);
    
    await deleteNotificationsByProjectId(projectId);
    return projectTitle;
}

export async function manuallyUpdateProjectStatusAndAssignment(
    params: {
        projectId: string;
        newStatus: string;
        newAssignedDivision: string;
        newNextAction: string | null;
        newProgress: number;
        adminUsername: string;
        reasonNote: string;
    }
): Promise<Project> {
    const { projectId, newStatus, newAssignedDivision, newNextAction, newProgress, adminUsername, reasonNote } = params;
    let projects = await readDb<Project[]>(DB_PATH, []);
    const projectIndex = projects.findIndex(p => p.id === projectId);

    if (projectIndex === -1) throw new Error('PROJECT_NOT_FOUND');

    const currentProject = projects[projectIndex];
    currentProject.status = newStatus;
    currentProject.assignedDivision = newAssignedDivision;
    currentProject.nextAction = newNextAction;
    currentProject.progress = newProgress;

    currentProject.workflowHistory.push({
        division: adminUsername,
        action: `Manually changed status to "${newStatus}" and assigned to "${newAssignedDivision}".`,
        timestamp: new Date().toISOString(),
        note: `Reason: ${reasonNote}`,
    });

    projects[projectIndex] = currentProject;
    await writeDb(DB_PATH, projects);
    
    if (newAssignedDivision && newStatus !== 'Completed' && newStatus !== 'Canceled') {
        const payload: NotificationPayload = {
            title: `Tugas Proyek: ${currentProject.title}`,
            body: `Status proyek "${currentProject.title}" telah diubah secara manual oleh ${adminUsername}. Tugas baru Anda: ${newNextAction || 'Tinjau proyek'}.`,
            url: `/dashboard/projects?projectId=${projectId}`
        };
        await notifyUsersByRole(newAssignedDivision, payload, projectId);
    }

    return currentProject;
}

export async function reviseProject(
    projectId: string,
    reviserUsername: string,
    reviserRole: string,
    revisionNote?: string,
    actionTaken: string = 'revise'
): Promise<Project | null> {
    let projects = await readDb<Project[]>(DB_PATH, []);
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) throw new Error('PROJECT_NOT_FOUND');

    const currentProject = projects[projectIndex];
    const projectWorkflowId = currentProject.workflowId || DEFAULT_WORKFLOW_ID;
    
    const revisionTransition = await getTransitionInfo(projectWorkflowId, currentProject.status, currentProject.progress, actionTaken);
    if (!revisionTransition) throw new Error('REVISION_NOT_SUPPORTED_FOR_CURRENT_STEP');

    currentProject.status = revisionTransition.targetStatus;
    currentProject.assignedDivision = revisionTransition.targetAssignedDivision;
    currentProject.nextAction = revisionTransition.targetNextActionDescription;
    currentProject.progress = revisionTransition.targetProgress;
    
    currentProject.workflowHistory.push({
        division: reviserRole,
        action: `${reviserUsername} (${reviserRole}) requested revision.`,
        timestamp: new Date().toISOString(),
        note: revisionNote,
    });
    
    await writeDb(DB_PATH, projects);

    if (revisionTransition.notification?.division) {
        const body = (revisionTransition.notification.message || "Proyek '{projectName}' memerlukan revisi dari Anda.")
            .replace('{projectName}', currentProject.title)
            .replace('{actorUsername}', reviserUsername)
            .replace('{reasonNote}', revisionNote || 'N/A');
        
        const payload: NotificationPayload = {
            title: `Revisi Diperlukan: ${currentProject.title}`,
            body: body,
            url: `/dashboard/projects?projectId=${projectId}`
        };
        await notifyUsersByRole(revisionTransition.notification.division, payload, projectId);
    }

    return currentProject;
}

export async function markParallelUploadsAsCompleteByDivision(
    projectId: string,
    division: string,
    username: string
): Promise<Project | null> {
    let projects = await readDb<Project[]>(DB_PATH, []);
    const projectIndex = projects.findIndex(p => p.id === projectId);

    if (projectIndex === -1) throw new Error('PROJECT_NOT_FOUND');

    const project = projects[projectIndex];
    
    if (!project.parallelUploadsCompletedBy) {
        project.parallelUploadsCompletedBy = [];
    }

    if (!project.parallelUploadsCompletedBy.includes(division)) {
        project.parallelUploadsCompletedBy.push(division);
        project.workflowHistory.push({
            division: username,
            action: `Marked their design/revision phase as complete.`,
            timestamp: new Date().toISOString(),
            note: `Divisi ${division} telah menyelesaikan tugasnya.`,
        });

        await writeDb(DB_PATH, projects);

        const payload: NotificationPayload = {
            title: `Progres Proyek: ${project.title}`,
            body: `"${username} (${division})" telah menyelesaikan unggahan mereka untuk proyek "${project.title}".`,
            url: `/dashboard/projects?projectId=${project.id}`
        };
        await notifyUsersByRole(['Admin Proyek', 'Owner'], payload, projectId);
        return project;
    }
    
    return project;
}
