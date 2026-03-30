import db from '../config/database'

const EVS_HOURLY_RATE = parseFloat(process.env.EVS_HOURLY_RATE || '18')
const TRANSPORT_HOURLY_RATE = parseFloat(process.env.TRANSPORT_HOURLY_RATE || '20')

export async function getCostPerTask(startDate: Date, endDate: Date) {
  const { data: records } = await db
    .from('CleanRecord')
    .select('*, staff:Staff(id,name)')
    .gte('completedAt', startDate.toISOString())
    .lte('completedAt', endDate.toISOString())
    .not('duration', 'is', null)

  const staffMap = new Map<string, { name: string; totalMinutes: number; tasks: number }>()
  for (const record of records || []) {
    const entry = staffMap.get(record.staffId) || { name: record.staff?.name || 'Unknown', totalMinutes: 0, tasks: 0 }
    entry.totalMinutes += record.duration || 0
    entry.tasks++
    staffMap.set(record.staffId, entry)
  }

  const breakdown = Array.from(staffMap.entries()).map(([staffId, d]) => {
    const hours = d.totalMinutes / 60
    return { staffId, staffName: d.name, hours, tasks: d.tasks, cost: hours * EVS_HOURLY_RATE }
  })

  const totalCost = breakdown.reduce((s, b) => s + b.cost, 0)
  const totalTasks = breakdown.reduce((s, b) => s + b.tasks, 0)
  return { totalCost, totalTasks, avgCostPerTask: totalTasks > 0 ? totalCost / totalTasks : 0, breakdown }
}

export async function getCostPerTransport(startDate: Date, endDate: Date) {
  const { data: jobs } = await db
    .from('TransportJob')
    .select('*, assignee:Staff!assignedTo(id,name)')
    .eq('status', 'complete')
    .gte('updatedAt', startDate.toISOString())
    .lte('updatedAt', endDate.toISOString())
    .not('assignedTo', 'is', null)

  const staffMap = new Map<string, { name: string; totalMinutes: number; jobs: number }>()
  for (const job of jobs || []) {
    if (!job.assignedTo) continue
    const ts = job.timestamps as Record<string, string>
    const duration = ts.accepted && ts.complete
      ? (new Date(ts.complete).getTime() - new Date(ts.accepted).getTime()) / 60000
      : 30
    const entry = staffMap.get(job.assignedTo) || { name: job.assignee?.name || 'Unknown', totalMinutes: 0, jobs: 0 }
    entry.totalMinutes += duration
    entry.jobs++
    staffMap.set(job.assignedTo, entry)
  }

  const breakdown = Array.from(staffMap.entries()).map(([staffId, d]) => {
    const hours = d.totalMinutes / 60
    return { staffId, staffName: d.name, hours, jobs: d.jobs, cost: hours * TRANSPORT_HOURLY_RATE }
  })

  const totalCost = breakdown.reduce((s, b) => s + b.cost, 0)
  const totalJobs = breakdown.reduce((s, b) => s + b.jobs, 0)
  return { totalCost, totalJobs, avgCostPerJob: totalJobs > 0 ? totalCost / totalJobs : 0, breakdown }
}

export async function getOvertimeRate(startDate: Date, endDate: Date) {
  const { data: schedules } = await db
    .from('Schedule')
    .select('shiftType')
    .gte('date', startDate.toISOString())
    .lte('date', endDate.toISOString())

  let scheduledHours = 0
  let overtimeHours = 0
  for (const s of schedules || []) {
    if (s.shiftType === 'day' || s.shiftType === 'evening') scheduledHours += 8
    else if (s.shiftType === 'overtime') { scheduledHours += 8; overtimeHours += 4 }
  }

  const overtimeRate = scheduledHours > 0 ? (overtimeHours / scheduledHours) * 100 : 0
  const overtimeCost = overtimeHours * ((EVS_HOURLY_RATE + TRANSPORT_HOURLY_RATE) / 2) * 1.5
  return { overtimeHours, scheduledHours, overtimeRate, overtimeCost }
}

export async function getTransportResponseTime(startDate: Date, endDate: Date) {
  const { data: jobs } = await db
    .from('TransportJob')
    .select('id, createdAt, status, timestamps')
    .gte('createdAt', startDate.toISOString())
    .lte('createdAt', endDate.toISOString())
    .neq('status', 'cancelled')

  if (!jobs || jobs.length === 0) return { avgMinutes: 0, acceptanceRate: 0 }

  let totalResponseMinutes = 0
  let acceptedCount = 0
  for (const job of jobs) {
    const ts = job.timestamps as Record<string, string>
    if (ts.accepted) {
      totalResponseMinutes += (new Date(ts.accepted).getTime() - new Date(job.createdAt).getTime()) / 60000
      acceptedCount++
    }
  }

  const relevantJobs = jobs.filter((j: any) => j.status !== 'requested').length
  return {
    avgMinutes: acceptedCount > 0 ? totalResponseMinutes / acceptedCount : 0,
    acceptanceRate: relevantJobs > 0 ? (acceptedCount / relevantJobs) * 100 : 0,
  }
}
