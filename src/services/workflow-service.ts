// src/services/workflow-service.ts
'use server';

import * as path from 'path';
import {
    DEFAULT_WORKFLOW_ID,
    DEFAULT_WORKFLOW_NAME,
    DEFAULT_WORKFLOW_DESCRIPTION
} from '../config/workflow-constants';
import type { Workflow, WorkflowStep, WorkflowStepTransition } from '../types/workflow-types';
import { readDb, writeDb } from '../lib/database-utils';

const DB_BASE_PATH = process.env.DATABASE_PATH || path.resolve(process.cwd());
const DB_PATH = path.join(DB_BASE_PATH, 'database', 'workflows.json');

export async function getAllWorkflows(): Promise<Workflow[]> {
  const workflows = await readDb<Workflow[]>(DB_PATH, []);
  return workflows;
}


export async function getWorkflowById(id: string): Promise<Workflow | null> {
  const workflows = await getAllWorkflows();
  const workflow = workflows.find(wf => wf.id === id) || null;
  if (!workflow) {
    console.warn(`[WorkflowService] getWorkflowById: Workflow with ID "${id}" not found.`);
  }
  return workflow;
}

export async function getFirstStep(workflowId: string): Promise<WorkflowStep | null> {
  const workflow = await getWorkflowById(workflowId);
  if (workflow && workflow.steps && workflow.steps.length > 0) {
    return workflow.steps[0];
  }
  console.warn(`[WorkflowService] Workflow with ID "${workflowId}" not found or has no steps when trying to get first step.`);
  return null;
}

export async function getCurrentStepDetails(
  workflowId: string,
  currentStatus: string,
  currentProgress: number
): Promise<WorkflowStep | null> {
  const workflow = await getWorkflowById(workflowId);
  if (!workflow) {
    console.warn(`[WorkflowService] Workflow with ID ${workflowId} not found when trying to get current step details.`);
    return null;
  }
  
  const step = workflow.steps.find(s => s.status === currentStatus && s.progress === currentProgress);
  if (!step) {
      console.warn(`[WorkflowService] Step with status "${currentStatus}" and progress ${currentProgress} not found in workflow "${workflowId}". Trying to find by status only as fallback.`);
      const stepsWithStatus = workflow.steps.filter(s => s.status === currentStatus);
      if (stepsWithStatus.length === 1) {
          console.warn(`[WorkflowService] Fallback: Found unique step by status "${currentStatus}" but progress mismatch (expected ${currentProgress}, found ${stepsWithStatus[0].progress}). This might indicate inconsistent project data or workflow definition.`);
          return stepsWithStatus[0];
      } else if (stepsWithStatus.length > 1) {
          console.error(`[WorkflowService] Ambiguous step: Multiple steps found with status "${currentStatus}" in workflow "${workflowId}" when progress did not match. Cannot determine current step reliably.`);
          return null;
      }
      console.error(`[WorkflowService] No step found for status "${currentStatus}" in workflow "${workflowId}" even as a fallback.`);
      return null;
  }
  return step;
}


export async function getTransitionInfo(
  workflowId: string,
  currentStatus: string,
  currentProgress: number,
  actionTaken: string = 'submitted'
): Promise<WorkflowStepTransition | null> {
  const workflow = await getWorkflowById(workflowId);
  if (!workflow) {
    console.error(`[WorkflowService] Workflow with ID ${workflowId} not found for transition.`);
    return null;
  }

  const currentStep = workflow.steps.find(step => step.status === currentStatus && step.progress === currentProgress);

  if (!currentStep) {
    console.error(`[WorkflowService] Current step for status "${currentStatus}" and progress ${currentProgress} not found in workflow "${workflowId}" for transition.`);
    return null;
  }

  if (!currentStep.transitions) {
    console.log(`[WorkflowService] Step "${currentStep.stepName}" in workflow "${workflowId}" is a terminal step (no transitions defined).`);
    return null;
  }

  const transition = currentStep.transitions[actionTaken];
  if (!transition) {
    console.warn(`[WorkflowService] No transition found for action "${actionTaken}" from step "${currentStep.stepName}" (status: ${currentStatus}, progress: ${currentProgress}) in workflow "${workflowId}".`);
    return null;
  }
  return transition;
}

export async function addWorkflow(name: string, description: string): Promise<Workflow> {
  let workflows = await readDb<Workflow[]>(DB_PATH, []);
  const msaWorkflow = workflows.find(wf => wf.id === 'msa_workflow');
  if(!msaWorkflow) throw new Error("Base 'msa_workflow' not found to create a new workflow.");

  const newWorkflowId = `wf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newWorkflow: Workflow = {
    id: newWorkflowId,
    name,
    description: description || '',
    steps: JSON.parse(JSON.stringify(msaWorkflow.steps)),
  };

  workflows.push(newWorkflow);
  await writeDb(DB_PATH, workflows);
  return newWorkflow;
}

export async function updateWorkflow(workflowId: string, updatedWorkflowData: Partial<Omit<Workflow, 'id'>>): Promise<Workflow | null> {
  let workflows = await readDb<Workflow[]>(DB_PATH, []);
  const index = workflows.findIndex(wf => wf.id === workflowId);

  if (index === -1) {
    return null;
  }

  const finalUpdatedWorkflow: Workflow = {
    ...workflows[index],
    ...updatedWorkflowData,
    id: workflows[index].id,
  };
  
  if (workflowId === DEFAULT_WORKFLOW_ID) {
    finalUpdatedWorkflow.name = updatedWorkflowData.name || DEFAULT_WORKFLOW_NAME;
    finalUpdatedWorkflow.description = updatedWorkflowData.description || DEFAULT_WORKFLOW_DESCRIPTION;
  }
  else if (workflowId === "msa_workflow") {
    finalUpdatedWorkflow.name = updatedWorkflowData.name || "MSa Workflow";
    finalUpdatedWorkflow.description = updatedWorkflowData.description || "Workflow with parallel design uploads after survey.";
  }


  workflows[index] = finalUpdatedWorkflow;

  await writeDb(DB_PATH, workflows);
  return workflows[index];
}

export async function deleteWorkflow(workflowId: string): Promise<void> {
  let workflows = await readDb<Workflow[]>(DB_PATH, []);
  const initialLength = workflows.length;

  if (workflowId === DEFAULT_WORKFLOW_ID || workflowId === "msa_workflow") {
       throw new Error('CANNOT_DELETE_PROTECTED_WORKFLOW');
  }

  const filteredWorkflows = workflows.filter(wf => wf.id !== workflowId);

  if (filteredWorkflows.length === initialLength) {
      console.warn(`[WorkflowService] Workflow with ID ${workflowId} not found for deletion.`);
  }

  await writeDb(DB_PATH, filteredWorkflows);
}

export async function getAllUniqueStatuses(): Promise<string[]> {
    const workflows = await getAllWorkflows(); 
    const allStatuses = new Set<string>();
    workflows.forEach(wf => {
        if (wf.steps && Array.isArray(wf.steps)) { 
            wf.steps.forEach(step => {
                allStatuses.add(step.status);
            });
        } else {
            console.warn(`[WorkflowService] Workflow "${wf.name}" (ID: ${wf.id}) has no steps or steps is not an array.`);
        }
    });
    return Array.from(allStatuses);
}
