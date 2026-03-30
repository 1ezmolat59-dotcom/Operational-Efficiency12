import { JobStatus, Equipment, JobPriority, JobType } from '@prisma/client';
import prisma from '../config/database';
import { createAlert } from './alertService';
import { sendJobDispatchNotification } from './notificationService';
import { emitJobCreated, emitJobAccepted, emitJobUpdate, emitActivityEntry } from '../socket';

// In-memory map of escalation timers per job
const escalationTimers = new Map<string, NodeJS.Timeout>();

interface CreateJobData {
  patientId: string;
  patientName: string;
  requestedBy: string;
  fromLocation: string;
  toLocation: string;
  roomId?: string;
  equipment?: Equipment;
  priority?: JobPriority;
  jobType?: JobType;
}

export async function createJob(data: CreateJobData) {
  const requester = await prisma.staff.findUnique({
    where: { id: data.requestedBy },
  });

  if (!requester) {
    throw new Error('Requester not found');
  }

  // Alert if a nurse/RN is doing transport
  if (requester.role === 'nurse') {
    await createAlert({
      type: 'rn_doing_transport',
      severity: 'warning',
      message: `Nurse ${requester.name} is requesting a transport job. Consider assigning to a transporter.`,
      staffId: data.requestedBy,
    });
  }

  const job = await prisma.transportJob.create({
    data: {
      patientId: data.patientId,
      patientName: data.patientName,
      requestedBy: data.requestedBy,
      fromLocation: data.fromLocation,
      toLocation: data.toLocation,
      roomId: data.roomId,
      equipment: data.equipment || 'none',
      priority: data.priority || 'routine',
      jobType: data.jobType || 'routine',
      status: 'requested',
      timestamps: { requested: new Date().toISOString() },
      requesterName: requester.name,
    },
    include: {
      requester: { select: { id: true, name: true, role: true } },
      room: true,
    },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      type: 'transport_job_created',
      message: `Transport job created for ${data.patientName} from ${data.fromLocation} to ${data.toLocation}`,
      data: { jobId: job.id, priority: job.priority },
      staffId: data.requestedBy,
      jobId: job.id,
    },
  });

  try {
    emitJobCreated(job);
    emitActivityEntry(
      'transport_job_created',
      `Transport job created for ${data.patientName}`,
      { jobId: job.id, priority: job.priority },
      new Date()
    );
  } catch {
    // Socket may not be initialized
  }

  // Dispatch to nearest available transporter
  await dispatchJob(job.id);

  return job;
}

export async function dispatchJob(jobId: string): Promise<void> {
  const job = await prisma.transportJob.findUnique({
    where: { id: jobId },
  });

  if (!job) return;

  // Find nearest available transporter (simplified: find first available)
  const availableTransporters = await prisma.staff.findMany({
    where: {
      role: 'transporter',
      availabilityStatus: true,
    },
    orderBy: { updatedAt: 'asc' },
  });

  // Try to find a transporter near the from location
  let bestTransporter = availableTransporters[0];

  if (!bestTransporter) {
    console.log(`[Transport] No available transporters for job ${jobId}. Will retry.`);
    // Create alert for supervisor
    await createAlert({
      type: 'transport_unaccepted',
      severity: 'warning',
      message: `No available transporters for job ${jobId}. Patient: ${job.patientName} from ${job.fromLocation}.`,
      jobId,
    });
    return;
  }

  // Assign job to transporter
  const updatedTimestamps = {
    ...(job.timestamps as Record<string, string>),
    dispatched: new Date().toISOString(),
  };

  await prisma.transportJob.update({
    where: { id: jobId },
    data: {
      assignedTo: bestTransporter.id,
      status: 'requested',
      timestamps: updatedTimestamps,
    },
  });

  // Mark transporter as unavailable
  await prisma.staff.update({
    where: { id: bestTransporter.id },
    data: { availabilityStatus: false },
  });

  // Send notification
  await sendJobDispatchNotification(jobId, bestTransporter.id);

  // Start 5-minute escalation timer
  const timer = setTimeout(async () => {
    await checkEscalation(jobId);
  }, 5 * 60 * 1000);

  escalationTimers.set(jobId, timer);

  console.log(`[Transport] Job ${jobId} dispatched to ${bestTransporter.name}`);
}

export async function acceptJob(jobId: string, transporterId: string) {
  const job = await prisma.transportJob.findUnique({
    where: { id: jobId },
    include: {
      assignee: { select: { id: true, name: true, role: true } },
    },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  if (job.assignedTo !== transporterId) {
    throw new Error('This job is not assigned to you');
  }

  if (job.status !== 'requested') {
    throw new Error(`Job cannot be accepted in status: ${job.status}`);
  }

  const updatedTimestamps = {
    ...(job.timestamps as Record<string, string>),
    accepted: new Date().toISOString(),
  };

  const updatedJob = await prisma.transportJob.update({
    where: { id: jobId },
    data: {
      status: 'accepted',
      timestamps: updatedTimestamps,
    },
    include: {
      assignee: { select: { id: true, name: true, role: true } },
      requester: { select: { id: true, name: true, role: true } },
    },
  });

  // Cancel the escalation timer
  const timer = escalationTimers.get(jobId);
  if (timer) {
    clearTimeout(timer);
    escalationTimers.delete(jobId);
  }

  // Log activity
  await prisma.activityLog.create({
    data: {
      type: 'transport_job_accepted',
      message: `Job accepted by ${updatedJob.assignee?.name}`,
      data: { jobId, transporterId },
      staffId: transporterId,
      jobId,
    },
  });

  try {
    emitJobAccepted(jobId, transporterId, updatedJob.assignee!);
    emitJobUpdate(jobId, 'accepted', updatedTimestamps);
  } catch {
    // Socket may not be initialized
  }

  return updatedJob;
}

export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  transporterId: string
) {
  const job = await prisma.transportJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  if (job.assignedTo !== transporterId) {
    throw new Error('You are not assigned to this job');
  }

  // Validate status transitions
  const validTransitions: Record<string, JobStatus[]> = {
    accepted: ['in_progress', 'cancelled'],
    in_progress: ['complete', 'cancelled'],
  };

  const allowed = validTransitions[job.status] || [];
  if (!allowed.includes(status)) {
    throw new Error(`Cannot transition from ${job.status} to ${status}`);
  }

  const timestampKey = status === 'in_progress' ? 'en_route' : status;
  const updatedTimestamps = {
    ...(job.timestamps as Record<string, string>),
    [timestampKey]: new Date().toISOString(),
  };

  const updatedJob = await prisma.transportJob.update({
    where: { id: jobId },
    data: {
      status,
      timestamps: updatedTimestamps,
    },
    include: {
      assignee: { select: { id: true, name: true } },
      requester: { select: { id: true, name: true } },
    },
  });

  // If completed, mark transporter as available again
  if (status === 'complete' || status === 'cancelled') {
    await prisma.staff.update({
      where: { id: transporterId },
      data: { availabilityStatus: true },
    });
  }

  // Log activity
  await prisma.activityLog.create({
    data: {
      type: 'transport_job_status_updated',
      message: `Job ${jobId} status updated to ${status}`,
      data: { jobId, status, transporterId },
      staffId: transporterId,
      jobId,
    },
  });

  try {
    emitJobUpdate(jobId, status, updatedTimestamps);
    emitActivityEntry(
      'transport_job_status_updated',
      `Transport job status updated to ${status}`,
      { jobId, status },
      new Date()
    );
  } catch {
    // Socket may not be initialized
  }

  return updatedJob;
}

export async function checkEscalation(jobId: string): Promise<void> {
  const job = await prisma.transportJob.findUnique({
    where: { id: jobId },
  });

  if (!job) return;

  // If job hasn't been accepted yet, escalate
  if (job.status === 'requested') {
    console.log(`[Transport] Escalating job ${jobId} - not accepted within 5 minutes`);

    await createAlert({
      type: 'transport_unaccepted',
      severity: 'critical',
      message: `Transport job not accepted within 5 minutes. Patient: ${job.patientName} from ${job.fromLocation} to ${job.toLocation}.`,
      jobId,
    });

    // Find supervisors to notify
    const supervisors = await prisma.staff.findMany({
      where: { role: { in: ['supervisor', 'admin'] } },
    });

    for (const supervisor of supervisors) {
      await prisma.activityLog.create({
        data: {
          type: 'transport_escalation',
          message: `Transport job ${jobId} escalated to ${supervisor.name}`,
          data: { jobId, reason: 'Not accepted within 5 minutes' },
          staffId: supervisor.id,
          jobId,
        },
      });
    }

    escalationTimers.delete(jobId);
  }
}

export async function getJobWithHistory(jobId: string) {
  return prisma.transportJob.findUnique({
    where: { id: jobId },
    include: {
      requester: { select: { id: true, name: true, role: true } },
      assignee: { select: { id: true, name: true, role: true } },
      room: true,
    },
  });
}

export async function listJobs(
  requesterId: string,
  requesterRole: string,
  statusFilter?: string,
  assignedToFilter?: string
) {
  const where: Record<string, unknown> = {};

  if (statusFilter) {
    where.status = statusFilter as JobStatus;
  }

  // Transporters can only see their own jobs
  if (requesterRole === 'transporter') {
    where.assignedTo = requesterId;
  } else if (assignedToFilter) {
    where.assignedTo = assignedToFilter;
  }

  return prisma.transportJob.findMany({
    where,
    include: {
      requester: { select: { id: true, name: true, role: true } },
      assignee: { select: { id: true, name: true, role: true } },
      room: true,
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });
}
