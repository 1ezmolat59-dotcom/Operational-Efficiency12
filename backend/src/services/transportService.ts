import db from '../config/database'
import { createAlert } from './alertService'
import { sendJobDispatchNotification } from './notificationService'
import { emitJobCreated, emitJobAccepted, emitJobUpdate, emitActivityEntry } from '../socket'

const escalationTimers = new Map<string, NodeJS.Timeout>()

interface CreateJobData {
  patientId: string
  patientName: string
  requestedBy: string
  fromLocation: string
  toLocation: string
  roomId?: string
  equipment?: string
  priority?: string
  jobType?: string
}

export async function createJob(data: CreateJobData) {
  const { data: requester } = await db.from('Staff').select('*').eq('id', data.requestedBy).single()
  if (!requester) throw new Error('Requester not found')

  if (requester.role === 'nurse') {
    await createAlert({
      type: 'rn_doing_transport', severity: 'warning',
      message: `Nurse ${requester.name} is requesting a transport job. Consider assigning to a transporter.`,
      staffId: data.requestedBy,
    })
  }

  const { data: job } = await db
    .from('TransportJob')
    .insert({
      patientId: data.patientId,
      patientName: data.patientName,
      requestedBy: data.requestedBy,
      fromLocation: data.fromLocation,
      toLocation: data.toLocation,
      roomId: data.roomId || null,
      equipment: data.equipment || 'none',
      priority: data.priority || 'routine',
      jobType: data.jobType || 'routine',
      status: 'requested',
      timestamps: { requested: new Date().toISOString() },
      requesterName: requester.name,
    })
    .select('*, requester:Staff!requestedBy(id,name,role)')
    .single()

  await db.from('ActivityLog').insert({
    type: 'transport_job_created',
    message: `Transport job created for ${data.patientName} from ${data.fromLocation} to ${data.toLocation}`,
    data: { jobId: job.id, priority: job.priority },
    staffId: data.requestedBy,
    jobId: job.id,
  })

  try {
    emitJobCreated(job)
    emitActivityEntry('transport_job_created', `Transport job created for ${data.patientName}`, { jobId: job.id, priority: job.priority }, new Date())
  } catch { /* Socket may not be initialized */ }

  await dispatchJob(job.id)
  return job
}

export async function dispatchJob(jobId: string): Promise<void> {
  const { data: job } = await db.from('TransportJob').select('*').eq('id', jobId).single()
  if (!job) return

  const { data: transporters } = await db
    .from('Staff')
    .select('*')
    .eq('role', 'transporter')
    .eq('availabilityStatus', true)
    .order('updatedAt', { ascending: true })

  if (!transporters || transporters.length === 0) {
    await createAlert({
      type: 'transport_unaccepted', severity: 'warning',
      message: `No available transporters for job. Patient: ${job.patientName} from ${job.fromLocation}.`,
      jobId,
    })
    return
  }

  const bestTransporter = transporters[0]
  const updatedTimestamps = { ...(job.timestamps as Record<string, string>), dispatched: new Date().toISOString() }

  await db.from('TransportJob').update({ assignedTo: bestTransporter.id, timestamps: updatedTimestamps }).eq('id', jobId)
  await db.from('Staff').update({ availabilityStatus: false }).eq('id', bestTransporter.id)

  await sendJobDispatchNotification(jobId, bestTransporter.id)

  const timer = setTimeout(async () => { await checkEscalation(jobId) }, 5 * 60 * 1000)
  escalationTimers.set(jobId, timer)

  console.log(`[Transport] Job ${jobId} dispatched to ${bestTransporter.name}`)
}

export async function acceptJob(jobId: string, transporterId: string) {
  const { data: job } = await db
    .from('TransportJob')
    .select('*, assignee:Staff!assignedTo(id,name,role)')
    .eq('id', jobId)
    .single()

  if (!job) throw new Error('Job not found')
  if (job.assignedTo !== transporterId) throw new Error('This job is not assigned to you')
  if (job.status !== 'requested') throw new Error(`Job cannot be accepted in status: ${job.status}`)

  const updatedTimestamps = { ...(job.timestamps as Record<string, string>), accepted: new Date().toISOString() }

  const { data: updatedJob } = await db
    .from('TransportJob')
    .update({ status: 'accepted', timestamps: updatedTimestamps })
    .eq('id', jobId)
    .select('*, assignee:Staff!assignedTo(id,name,role), requester:Staff!requestedBy(id,name,role)')
    .single()

  const timer = escalationTimers.get(jobId)
  if (timer) { clearTimeout(timer); escalationTimers.delete(jobId) }

  await db.from('ActivityLog').insert({
    type: 'transport_job_accepted',
    message: `Job accepted by ${updatedJob.assignee?.name}`,
    data: { jobId, transporterId },
    staffId: transporterId, jobId,
  })

  try {
    emitJobAccepted(jobId, transporterId, updatedJob.assignee)
    emitJobUpdate(jobId, 'accepted', updatedTimestamps)
  } catch { /* Socket may not be initialized */ }

  return updatedJob
}

export async function updateJobStatus(jobId: string, status: string, transporterId: string) {
  const { data: job } = await db.from('TransportJob').select('*').eq('id', jobId).single()
  if (!job) throw new Error('Job not found')
  if (job.assignedTo !== transporterId) throw new Error('You are not assigned to this job')

  const validTransitions: Record<string, string[]> = {
    accepted: ['in_progress', 'cancelled'],
    in_progress: ['complete', 'cancelled'],
  }
  const allowed = validTransitions[job.status] || []
  if (!allowed.includes(status)) throw new Error(`Cannot transition from ${job.status} to ${status}`)

  const timestampKey = status === 'in_progress' ? 'en_route' : status
  const updatedTimestamps = { ...(job.timestamps as Record<string, string>), [timestampKey]: new Date().toISOString() }

  const { data: updatedJob } = await db
    .from('TransportJob')
    .update({ status, timestamps: updatedTimestamps })
    .eq('id', jobId)
    .select('*, assignee:Staff!assignedTo(id,name), requester:Staff!requestedBy(id,name)')
    .single()

  if (status === 'complete' || status === 'cancelled') {
    await db.from('Staff').update({ availabilityStatus: true }).eq('id', transporterId)
  }

  await db.from('ActivityLog').insert({
    type: 'transport_job_status_updated',
    message: `Job status updated to ${status}`,
    data: { jobId, status, transporterId },
    staffId: transporterId, jobId,
  })

  try {
    emitJobUpdate(jobId, status, updatedTimestamps)
    emitActivityEntry('transport_job_status_updated', `Transport job status updated to ${status}`, { jobId, status }, new Date())
  } catch { /* Socket may not be initialized */ }

  return updatedJob
}

export async function checkEscalation(jobId: string): Promise<void> {
  const { data: job } = await db.from('TransportJob').select('*').eq('id', jobId).single()
  if (!job || job.status !== 'requested') return

  await createAlert({
    type: 'transport_unaccepted', severity: 'critical',
    message: `Transport job not accepted within 5 minutes. Patient: ${job.patientName} from ${job.fromLocation} to ${job.toLocation}.`,
    jobId,
  })

  const { data: supervisors } = await db.from('Staff').select('*').in('role', ['supervisor', 'admin'])
  for (const supervisor of supervisors || []) {
    await db.from('ActivityLog').insert({
      type: 'transport_escalation',
      message: `Transport job escalated to ${supervisor.name}`,
      data: { jobId, reason: 'Not accepted within 5 minutes' },
      staffId: supervisor.id, jobId,
    })
  }

  escalationTimers.delete(jobId)
}

export async function getJobWithHistory(jobId: string) {
  const { data } = await db
    .from('TransportJob')
    .select('*, requester:Staff!requestedBy(id,name,role), assignee:Staff!assignedTo(id,name,role), room:Room(*)')
    .eq('id', jobId)
    .single()
  return data
}

export async function listJobs(requesterId: string, requesterRole: string, statusFilter?: string, assignedToFilter?: string) {
  let query = db
    .from('TransportJob')
    .select('*, requester:Staff!requestedBy(id,name,role), assignee:Staff!assignedTo(id,name,role), room:Room(*)')
    .order('createdAt', { ascending: false })

  if (statusFilter) query = query.eq('status', statusFilter)
  if (requesterRole === 'transporter') {
    query = query.eq('assignedTo', requesterId)
  } else if (assignedToFilter) {
    query = query.eq('assignedTo', assignedToFilter)
  }

  const { data } = await query
  return data || []
}
