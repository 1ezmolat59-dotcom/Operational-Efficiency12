import db from '../config/database'
import { createAlert } from './alertService'
import { sendRoomReadyNotification } from './notificationService'
import { calculateScore } from './complianceService'
import { createJob } from './transportService'
import { emitRoomUpdate, emitRoomCompleted, emitRoomAssigned, emitActivityEntry } from '../socket'
import { ChecklistStep } from '../types'

interface CompleteRoomData {
  steps: ChecklistStep[]
  photos: string[]
  staffId: string
}

export async function getTaskQueue(staffId: string) {
  const { data: staff } = await db.from('Staff').select('*').eq('id', staffId).single()
  if (!staff) throw new Error('Staff not found')

  let query = db
    .from('Room')
    .select('*, wing:Wing(*), cleanRecords:CleanRecord(*)')
    .in('status', ['dirty', 'in_progress'])
    .order('updatedAt', { ascending: true })

  if (staff.wingId) query = query.eq('wingId', staff.wingId)

  const { data: rooms } = await query

  const all = rooms || []
  const dischargeTasks = all.filter((r: any) =>
    r.cleanRecords?.[0]?.cleanType === 'discharge' || (r.isLockIn && r.status === 'dirty')
  )
  const checkoutTasks = all.filter((r: any) =>
    r.cleanRecords?.[0]?.cleanType === 'checkout' && !r.isLockIn
  )
  const routineTasks = all.filter((r: any) =>
    (!r.cleanRecords?.[0] || r.cleanRecords?.[0]?.cleanType === 'routine') && !r.isLockIn
  )

  dischargeTasks.sort(
    (a: any, b: any) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
  )

  return {
    queue: [...dischargeTasks, ...checkoutTasks, ...routineTasks],
    counts: { discharge: dischargeTasks.length, checkout: checkoutTasks.length, routine: routineTasks.length },
  }
}

export async function completeRoom(roomId: string, data: CompleteRoomData) {
  const { data: room } = await db.from('Room').select('*, wing:Wing(*)').eq('id', roomId).single()
  if (!room) throw new Error('Room not found')

  const { data: cleanRecord } = await db
    .from('CleanRecord')
    .select('*')
    .eq('roomId', roomId)
    .eq('staffId', data.staffId)
    .is('completedAt', null)
    .order('createdAt', { ascending: false })
    .limit(1)
    .single()

  if (!cleanRecord) throw new Error('No active clean record found for this room and staff')

  const complianceScore = calculateScore(data.steps)
  const completedAt = new Date().toISOString()
  const durationMinutes = Math.round(
    (new Date(completedAt).getTime() - new Date(cleanRecord.startedAt).getTime()) / 60000
  )

  const { data: updatedRecord } = await db
    .from('CleanRecord')
    .update({ completedAt, stepsCompleted: data.steps, photos: data.photos, complianceScore, duration: durationMinutes })
    .eq('id', cleanRecord.id)
    .select('*, staff:Staff(id,name,role), room:Room(*)')
    .single()

  await db.from('Room').update({ status: 'clean_ready', lastCleanId: cleanRecord.id, updatedAt: completedAt }).eq('id', roomId)

  await db.from('ActivityLog').insert({
    type: 'room_cleaned',
    message: `Room ${room.roomNumber} cleaned in ${durationMinutes} minutes`,
    data: { roomId, duration: durationMinutes, complianceScore, cleanType: cleanRecord.cleanType },
    staffId: data.staffId,
    roomId,
  })

  try {
    emitRoomUpdate(roomId, 'clean_ready', room.roomNumber, room.wingId)
    emitRoomCompleted(roomId, updatedRecord, durationMinutes, room.wingId)
    emitActivityEntry('room_cleaned', `Room ${room.roomNumber} is now clean and ready`, { roomId, duration: durationMinutes, complianceScore }, new Date())
  } catch { /* Socket may not be initialized */ }

  if (complianceScore < 100) {
    await createAlert({
      type: 'checklist_skipped',
      severity: 'critical',
      message: `Room ${room.roomNumber} completed with ${complianceScore.toFixed(1)}% compliance. Some steps were skipped.`,
      roomId,
      staffId: data.staffId,
    })
  }

  if (room.wingId) {
    const { data: nurses } = await db
      .from('Staff')
      .select('*')
      .eq('role', 'nurse')
      .eq('wingId', room.wingId)
      .eq('availabilityStatus', true)

    for (const nurse of nurses || []) {
      await sendRoomReadyNotification(roomId, nurse.id)
    }
  }

  return updatedRecord
}

export async function assignPatient(roomId: string, patientId: string, patientName: string, nurseId: string) {
  const { data: room } = await db.from('Room').select('*, wing:Wing(*)').eq('id', roomId).single()
  if (!room) throw new Error('Room not found')
  if (room.status !== 'clean_ready') {
    throw new Error(`Room ${room.roomNumber} is not clean and ready. Current status: ${room.status}`)
  }

  const { data: updatedRoom } = await db
    .from('Room')
    .update({ status: 'occupied', currentPatientId: patientId, patientName, updatedAt: new Date().toISOString() })
    .eq('id', roomId)
    .select('*, wing:Wing(*)')
    .single()

  await db.from('ActivityLog').insert({
    type: 'patient_assigned',
    message: `Patient ${patientName} assigned to room ${room.roomNumber}`,
    data: { roomId, patientId, patientName, nurseId },
    staffId: nurseId,
    roomId,
  })

  try {
    emitRoomUpdate(roomId, 'occupied', room.roomNumber, room.wingId)
    emitRoomAssigned(roomId, patientName, nurseId)
    emitActivityEntry('patient_assigned', `Patient assigned to room ${room.roomNumber}`, { roomId, patientName }, new Date())
  } catch { /* Socket may not be initialized */ }

  if (room.mobilityEquipmentRequired) {
    try {
      await createJob({
        patientId, patientName, requestedBy: nurseId,
        fromLocation: `Room ${room.roomNumber}`, toLocation: 'Admissions',
        roomId, equipment: 'wheelchair', priority: 'routine', jobType: 'routine',
      })
    } catch (err) {
      console.error('[RoomService] Failed to auto-create transport job:', err)
    }
  }

  return updatedRoom
}

export async function getRoomStatus(wingId?: string) {
  let query = db
    .from('Room')
    .select('*, wing:Wing(*), cleanRecords:CleanRecord(*, staff:Staff(id,name))')
    .order('wingId', { ascending: true })
    .order('roomNumber', { ascending: true })

  if (wingId) query = query.eq('wingId', wingId)

  const { data: rooms } = await query

  return (rooms || []).map((room: any) => {
    const lastClean = room.cleanRecords?.[room.cleanRecords.length - 1] || null
    return {
      ...room,
      lastClean,
      colorCode: getStatusColor(room.status),
      timeSinceUpdate: Math.round((Date.now() - new Date(room.updatedAt).getTime()) / 60000),
    }
  })
}

function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    dirty: '#FF4444', in_progress: '#FFA500', clean_ready: '#44FF44', occupied: '#4444FF', offline: '#888888',
  }
  return map[status] || '#888888'
}

export async function startClean(roomId: string, staffId: string, cleanType?: string) {
  const { data: room } = await db.from('Room').select('*, wing:Wing(*)').eq('id', roomId).single()
  if (!room) throw new Error('Room not found')
  if (room.status === 'in_progress') throw new Error('Room is already being cleaned')
  if (room.status === 'occupied') throw new Error('Room is occupied')

  const inferredCleanType = cleanType || 'routine'

  const { data: cleanRecord } = await db
    .from('CleanRecord')
    .insert({ roomId, staffId, cleanType: inferredCleanType, startedAt: new Date().toISOString() })
    .select()
    .single()

  await db.from('Room').update({ status: 'in_progress', updatedAt: new Date().toISOString() }).eq('id', roomId)

  await db.from('ActivityLog').insert({
    type: 'room_clean_started',
    message: `Cleaning started for room ${room.roomNumber}`,
    data: { roomId, cleanType: inferredCleanType },
    staffId, roomId,
  })

  try {
    emitRoomUpdate(roomId, 'in_progress', room.roomNumber, room.wingId)
    emitActivityEntry('room_clean_started', `Cleaning started for room ${room.roomNumber}`, { roomId, cleanType: inferredCleanType }, new Date())
  } catch { /* Socket may not be initialized */ }

  return cleanRecord
}
