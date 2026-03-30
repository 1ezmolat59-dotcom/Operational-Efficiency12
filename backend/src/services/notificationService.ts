import db from '../config/database'

interface PushNotificationData {
  [key: string]: string | number | boolean
}

export async function sendPushNotification(userId: string, title: string, body: string, data?: PushNotificationData): Promise<void> {
  const fcmKey = process.env.FCM_SERVER_KEY

  if (!fcmKey || process.env.NODE_ENV === 'development') {
    console.log(`[FCM STUB] Push notification to user ${userId}:`)
    console.log(`  Title: ${title}`)
    console.log(`  Body: ${body}`)
    if (data) console.log(`  Data:`, data)
    return
  }

  try {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: { Authorization: `key=${fcmKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: `/topics/user_${userId}`, notification: { title, body }, data: data || {} }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[FCM] Failed to send push notification:', errorText)
    }
  } catch (error) {
    console.error('[FCM] Error sending push notification:', error)
  }
}

export async function sendRoomReadyNotification(roomId: string, nurseId: string): Promise<void> {
  try {
    const { data: room } = await db.from('Room').select('roomNumber, wingId, wing:Wing(name)').eq('id', roomId).single()
    if (!room) { console.error(`[Notification] Room ${roomId} not found`); return }

    const { data: nurse } = await db.from('Staff').select('name').eq('id', nurseId).single()
    if (!nurse) { console.error(`[Notification] Nurse ${nurseId} not found`); return }

    await sendPushNotification(
      nurseId,
      'Room Ready',
      `Room ${room.roomNumber} in ${(room.wing as any)?.name} is now clean and ready for patient assignment.`,
      { roomId, roomNumber: room.roomNumber, wingId: room.wingId, type: 'room_ready' }
    )

    console.log(`[Notification] Room ready notification sent to nurse ${nurse.name} for room ${room.roomNumber}`)
  } catch (error) {
    console.error('[Notification] Failed to send room ready notification:', error)
  }
}

export async function sendJobDispatchNotification(jobId: string, transporterId: string): Promise<void> {
  try {
    const { data: job } = await db.from('TransportJob').select('patientName,fromLocation,toLocation,priority,equipment').eq('id', jobId).single()
    if (!job) { console.error(`[Notification] Job ${jobId} not found`); return }

    const { data: transporter } = await db.from('Staff').select('name').eq('id', transporterId).single()
    if (!transporter) { console.error(`[Notification] Transporter ${transporterId} not found`); return }

    await sendPushNotification(
      transporterId,
      'New Transport Job',
      `${job.priority === 'stat' ? 'STAT: ' : ''}Transport ${job.patientName} from ${job.fromLocation} to ${job.toLocation}`,
      { jobId, patientName: job.patientName, fromLocation: job.fromLocation, toLocation: job.toLocation, priority: job.priority, equipment: job.equipment, type: 'job_dispatch' }
    )

    console.log(`[Notification] Job dispatch notification sent to transporter ${transporter.name} for job ${jobId}`)
  } catch (error) {
    console.error('[Notification] Failed to send job dispatch notification:', error)
  }
}

export async function sendAlertNotification(supervisorId: string, alertType: string, message: string): Promise<void> {
  await sendPushNotification(supervisorId, `Alert: ${alertType}`, message, { alertType, type: 'alert' })
}
