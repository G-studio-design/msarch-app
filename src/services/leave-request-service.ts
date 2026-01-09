// src/services/leave-request-service.ts
'use server';

import * as path from 'path';
import { notifyUsersByRole, notifyUserById, type NotificationPayload } from './notification-service';
import type { LeaveRequest, AddLeaveRequestData } from '@/types/leave-request-types';
import { readDb, writeDb } from '../lib/database-utils';

const DB_BASE_PATH = process.env.DATABASE_PATH || path.resolve(process.cwd());
const DB_PATH = path.join(DB_BASE_PATH, 'database', 'leave_requests.json');

export async function addLeaveRequest(data: AddLeaveRequestData): Promise<LeaveRequest> {
  const leaveRequests = await readDb<LeaveRequest[]>(DB_PATH, []);
  const now = new Date();

  const newRequest: LeaveRequest = {
    id: `leave_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: data.userId,
    username: data.username,
    displayName: data.displayName || data.username,
    requestDate: now.toISOString(),
    leaveType: data.leaveType,
    startDate: data.startDate,
    endDate: data.endDate,
    reason: data.reason,
    status: 'Pending',
  };

  leaveRequests.push(newRequest);
  await writeDb(DB_PATH, leaveRequests);

  // Send notification to the "Owner" role
  const payload: NotificationPayload = {
    title: "Permintaan Izin Baru",
    body: `Karyawan "${data.displayName || data.username}" mengajukan ${data.leaveType} dari ${data.startDate} s/d ${data.endDate}.`,
    url: '/dashboard/admin-actions/leave-approvals'
  };
  await notifyUsersByRole('Owner', payload);

  console.log(`[LeaveRequestService] Leave request added for ${data.username}. Delegating Owner notification.`);
  return newRequest;
}

export async function getAllLeaveRequests(): Promise<LeaveRequest[]> {
  const allRequests = await readDb<LeaveRequest[]>(DB_PATH, []);
  return allRequests.sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
}

export async function getApprovedLeaveRequests(): Promise<LeaveRequest[]> {
  const allRequests = await readDb<LeaveRequest[]>(DB_PATH, []);
  return allRequests.filter(req => req.status === 'Approved');
}

export async function approveLeaveRequest(requestId: string, approverUserId: string, approverUsername: string): Promise<LeaveRequest | null> {
  const leaveRequests = await readDb<LeaveRequest[]>(DB_PATH, []);
  const requestIndex = leaveRequests.findIndex(req => req.id === requestId);

  if (requestIndex === -1) {
    console.warn(`[LeaveRequestService] Leave request with ID ${requestId} not found for approval.`);
    return null;
  }

  if (leaveRequests[requestIndex].status !== 'Pending') {
    console.warn(`[LeaveRequestService] Leave request ${requestId} is not in Pending state, cannot approve.`);
    return null;
  }

  leaveRequests[requestIndex].status = 'Approved';
  leaveRequests[requestIndex].approvedRejectedBy = approverUserId;
  leaveRequests[requestIndex].approvedRejectedAt = new Date().toISOString();

  await writeDb(DB_PATH, leaveRequests);
  const updatedRequest = leaveRequests[requestIndex];

  // Notify the employee that their request was approved
  const payload: NotificationPayload = {
    title: "Permintaan Izin Disetujui",
    body: `Permintaan izin Anda (${updatedRequest.leaveType}) untuk tanggal ${updatedRequest.startDate} telah disetujui oleh ${approverUsername}.`,
    url: `/dashboard/leave-request/new`
  };
  await notifyUserById(updatedRequest.userId, payload);
  console.log(`[LeaveRequestService] User ${updatedRequest.userId} notified of leave approval.`);

  return updatedRequest;
}

export async function rejectLeaveRequest(requestId: string, rejectorUserId: string, rejectorUsername: string, rejectionReason: string): Promise<LeaveRequest | null> {
  const leaveRequests = await readDb<LeaveRequest[]>(DB_PATH, []);
  const requestIndex = leaveRequests.findIndex(req => req.id === requestId);

  if (requestIndex === -1) {
    console.warn(`[LeaveRequestService] Leave request with ID ${requestId} not found for rejection.`);
    return null;
  }

  if (leaveRequests[requestIndex].status !== 'Pending') {
    console.warn(`[LeaveRequestService] Leave request ${requestId} is not in Pending state, cannot reject.`);
    return null;
  }

  leaveRequests[requestIndex].status = 'Rejected';
  leaveRequests[requestIndex].approvedRejectedBy = rejectorUserId;
  leaveRequests[requestIndex].approvedRejectedAt = new Date().toISOString();
  leaveRequests[requestIndex].rejectionReason = rejectionReason;

  await writeDb(DB_PATH, leaveRequests);
  const updatedRequest = leaveRequests[requestIndex];

  // Notify the employee that their request was rejected
  const payload: NotificationPayload = {
    title: "Permintaan Izin Ditolak",
    body: `Izin Anda (${updatedRequest.leaveType}) untuk ${updatedRequest.startDate} ditolak oleh ${rejectorUsername}. Alasan: ${rejectionReason}`,
    url: `/dashboard/leave-request/new`
  };
  await notifyUserById(updatedRequest.userId, payload);
  console.log(`[LeaveRequestService] User ${updatedRequest.userId} notified of leave rejection.`);

  return updatedRequest;
}

export async function getLeaveRequestsByUserId(userId: string): Promise<LeaveRequest[]> {
    const allRequests = await readDb<LeaveRequest[]>(DB_PATH, []);
    return allRequests.filter(req => req.userId === userId).sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
}
