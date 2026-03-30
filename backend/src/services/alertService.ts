import db from '../config/database'
import { emitAlert, emitAlertResolved } from '../socket'

interface CreateAlertData {
  type: string
  severity: string
  message: string
  roomId?: string
  staffId?: string
  jobId?: string
}

export async function createAlert(data: CreateAlertData) {
  try {
    const { data: alert, error } = await db
      .from('Alert')
      .insert({ type: data.type, severity: data.severity, message: data.message, roomId: data.roomId || null, staffId: data.staffId || null, jobId: data.jobId || null, resolved: false })
      .select()
      .single()

    if (error) throw error

    await db.from('ActivityLog').insert({
      type: 'alert_created',
      message: `Alert: ${data.message}`,
      data: { alertId: alert.id, type: data.type, severity: data.severity },
      roomId: data.roomId || null,
      staffId: data.staffId || null,
      jobId: data.jobId || null,
    })

    try { emitAlert(alert) } catch { /* Socket may not be initialized */ }
    return alert
  } catch (error) {
    console.error('[AlertService] Failed to create alert:', error)
    throw error
  }
}

export async function resolveAlert(alertId: string) {
  const { data: alert } = await db.from('Alert').update({ resolved: true }).eq('id', alertId).select().single()
  try { emitAlertResolved(alertId) } catch { /* Socket may not be initialized */ }
  return alert
}

export async function getActiveAlerts() {
  const { data: alerts } = await db.from('Alert').select('*').eq('resolved', false).order('createdAt', { ascending: false })
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }
  return (alerts || []).sort((a: any, b: any) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3))
}

export async function checkBedUnassigned(): Promise<void> {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: rooms } = await db.from('Room').select('*').eq('status', 'clean_ready').is('currentPatientId', null).lte('updatedAt', thirtyMinutesAgo)

  for (const room of rooms || []) {
    const { data: existing } = await db.from('Alert').select('id').eq('type', 'bed_unassigned').eq('roomId', room.id).eq('resolved', false).limit(1).single()
    if (!existing) {
      await createAlert({ type: 'bed_unassigned', severity: 'warning', message: `Room ${room.roomNumber} has been clean and ready for over 30 minutes with no patient assigned.`, roomId: room.id })
    }
  }
}

export async function checkStaffNoShow(): Promise<void> {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const now = new Date().toISOString()
  const { data: staff } = await db.from('Staff').select('*').eq('availabilityStatus', true).lte('shiftStart', now).gte('shiftEnd', now)

  for (const member of staff || []) {
    const { data: recentClean } = await db.from('CleanRecord').select('id').eq('staffId', member.id).gte('startedAt', thirtyMinutesAgo).limit(1).single()
    const { data: recentTransport } = await db.from('TransportJob').select('id').eq('assignedTo', member.id).gte('updatedAt', thirtyMinutesAgo).limit(1).single()

    if (!recentClean && !recentTransport) {
      const { data: existing } = await db.from('Alert').select('id').eq('type', 'staff_no_show').eq('staffId', member.id).eq('resolved', false).gte('createdAt', thirtyMinutesAgo).limit(1).single()
      if (!existing) {
        await createAlert({ type: 'staff_no_show', severity: 'warning', message: `Staff member ${member.name} has been on shift with no activity for over 30 minutes.`, staffId: member.id })
      }
    }
  }
}
