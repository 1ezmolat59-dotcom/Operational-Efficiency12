import { RoomStatus, CleanType } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
import prisma from '../config/database';
import { createAlert } from './alertService';
import { sendRoomReadyNotification } from './notificationService';
import { calculateScore } from './complianceService';
import { createJob } from './transportService';
import {
  emitRoomUpdate,
  emitRoomCompleted,
  emitRoomAssigned,
  emitActivityEntry,
} from '../socket';
import { ChecklistStep } from '../types';

interface CompleteRoomData {
  steps: ChecklistStep[];
  photos: string[];
  staffId: string;
  cleanRecordId?: string;
}

export async function getTaskQueue(staffId: string) {
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
  });

  if (!staff) throw new Error('Staff not found');

  const where: Record<string, unknown> = {};
  if (staff.wingId) {
    where.wingId = staff.wingId;
  }

  const rooms = await prisma.room.findMany({
    where: {
      ...where,
      status: { in: ['dirty', 'in_progress'] },
    },
    include: {
      cleanRecords: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      wing: true,
    },
    orderBy: { updatedAt: 'asc' },
  });

  // Prioritize: discharge first, then checkout, then routine
  // Lock-in areas always included
  const dischargeTasks = rooms.filter(
    (r) =>
      r.cleanRecords[0]?.cleanType === CleanType.discharge ||
      (r.isLockIn && r.status === 'dirty')
  );
  const checkoutTasks = rooms.filter(
    (r) =>
      r.cleanRecords[0]?.cleanType === CleanType.checkout && !r.isLockIn
  );
  const routineTasks = rooms.filter(
    (r) =>
      (!r.cleanRecords[0] || r.cleanRecords[0]?.cleanType === CleanType.routine) && !r.isLockIn
  );

  // Sort discharge by time since last update (oldest first)
  dischargeTasks.sort(
    (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
  );

  return {
    queue: [...dischargeTasks, ...checkoutTasks, ...routineTasks],
    counts: {
      discharge: dischargeTasks.length,
      checkout: checkoutTasks.length,
      routine: routineTasks.length,
    },
  };
}

export async function completeRoom(
  roomId: string,
  data: CompleteRoomData,
  io?: SocketIOServer
) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { wing: true },
  });

  if (!room) throw new Error('Room not found');

  // Find the active clean record for this room by this staff
  const cleanRecord = await prisma.cleanRecord.findFirst({
    where: {
      roomId,
      staffId: data.staffId,
      completedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!cleanRecord) {
    throw new Error('No active clean record found for this room and staff');
  }

  const complianceScore = calculateScore(data.steps);
  const completedAt = new Date();
  const durationMinutes = Math.round(
    (completedAt.getTime() - new Date(cleanRecord.startedAt).getTime()) / (1000 * 60)
  );

  // Update the clean record (immutable after this point)
  const updatedRecord = await prisma.cleanRecord.update({
    where: { id: cleanRecord.id },
    data: {
      completedAt,
      stepsCompleted: data.steps,
      photos: data.photos,
      complianceScore,
      duration: durationMinutes,
    },
    include: {
      staff: { select: { id: true, name: true, role: true } },
      room: true,
    },
  });

  // Update room status to clean_ready
  await prisma.room.update({
    where: { id: roomId },
    data: {
      status: RoomStatus.clean_ready,
      lastCleanId: cleanRecord.id,
      updatedAt: new Date(),
    },
  });

  // Log turnaround in ActivityLog
  await prisma.activityLog.create({
    data: {
      type: 'room_cleaned',
      message: `Room ${room.roomNumber} cleaned in ${durationMinutes} minutes by ${updatedRecord.staff.name}`,
      data: {
        roomId,
        duration: durationMinutes,
        complianceScore,
        cleanType: cleanRecord.cleanType,
      },
      staffId: data.staffId,
      roomId,
    },
  });

  // Emit socket events
  try {
    emitRoomUpdate(roomId, 'clean_ready', room.roomNumber, room.wingId);
    emitRoomCompleted(roomId, updatedRecord, durationMinutes, room.wingId);
    emitActivityEntry(
      'room_cleaned',
      `Room ${room.roomNumber} is now clean and ready`,
      { roomId, duration: durationMinutes, complianceScore },
      new Date()
    );
  } catch {
    // Socket may not be initialized
  }

  // Create alert if compliance is below 100%
  if (complianceScore < 100) {
    await createAlert({
      type: 'checklist_skipped',
      severity: 'critical',
      message: `Room ${room.roomNumber} completed with ${complianceScore.toFixed(1)}% checklist compliance. Some steps were skipped.`,
      roomId,
      staffId: data.staffId,
    });
  }

  // Notify nursing staff that room is ready
  // Find nurses in the same wing
  if (room.wingId) {
    const wingNurses = await prisma.staff.findMany({
      where: {
        role: 'nurse',
        wingId: room.wingId,
        availabilityStatus: true,
      },
    });

    for (const nurse of wingNurses) {
      await sendRoomReadyNotification(roomId, nurse.id);
    }
  }

  return updatedRecord;
}

export async function assignPatient(
  roomId: string,
  patientId: string,
  patientName: string,
  nurseId: string
) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { wing: true },
  });

  if (!room) throw new Error('Room not found');

  if (room.status !== 'clean_ready') {
    throw new Error(`Room ${room.roomNumber} is not clean and ready. Current status: ${room.status}`);
  }

  const updatedRoom = await prisma.room.update({
    where: { id: roomId },
    data: {
      status: RoomStatus.occupied,
      currentPatientId: patientId,
      patientName,
      updatedAt: new Date(),
    },
    include: { wing: true },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      type: 'patient_assigned',
      message: `Patient ${patientName} assigned to room ${room.roomNumber}`,
      data: { roomId, patientId, patientName, nurseId },
      staffId: nurseId,
      roomId,
    },
  });

  try {
    emitRoomUpdate(roomId, 'occupied', room.roomNumber, room.wingId);
    emitRoomAssigned(roomId, patientName, nurseId);
    emitActivityEntry(
      'patient_assigned',
      `Patient assigned to room ${room.roomNumber}`,
      { roomId, patientName },
      new Date()
    );
  } catch {
    // Socket may not be initialized
  }

  // Auto-trigger transport if mobility equipment is required
  if (room.mobilityEquipmentRequired) {
    try {
      await createJob({
        patientId,
        patientName,
        requestedBy: nurseId,
        fromLocation: `Room ${room.roomNumber}`,
        toLocation: 'Admissions',
        roomId,
        equipment: 'wheelchair',
        priority: 'routine',
        jobType: 'routine',
      });
    } catch (err) {
      console.error('[RoomService] Failed to auto-create transport job:', err);
    }
  }

  return updatedRoom;
}

export async function getRoomStatus(wingId?: string) {
  const where: Record<string, unknown> = {};
  if (wingId) where.wingId = wingId;

  const rooms = await prisma.room.findMany({
    where,
    include: {
      wing: true,
      cleanRecords: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          staff: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ wingId: 'asc' }, { roomNumber: 'asc' }],
  });

  return rooms.map((room) => {
    const lastClean = room.cleanRecords[0] || null;
    const colorCode = getStatusColor(room.status);
    return {
      ...room,
      lastClean,
      colorCode,
      timeSinceUpdate: Math.round(
        (Date.now() - new Date(room.updatedAt).getTime()) / (1000 * 60)
      ),
    };
  });
}

function getStatusColor(status: RoomStatus): string {
  const colorMap: Record<RoomStatus, string> = {
    dirty: '#FF4444',
    in_progress: '#FFA500',
    clean_ready: '#44FF44',
    occupied: '#4444FF',
    offline: '#888888',
  };
  return colorMap[status] || '#888888';
}

export async function startClean(roomId: string, staffId: string, cleanType?: CleanType) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { wing: true },
  });

  if (!room) throw new Error('Room not found');

  if (room.status === 'in_progress') {
    throw new Error('Room is already being cleaned');
  }

  if (room.status === 'occupied') {
    throw new Error('Room is occupied');
  }

  // Determine clean type from context if not provided
  const inferredCleanType: CleanType = cleanType || CleanType.routine;

  const cleanRecord = await prisma.cleanRecord.create({
    data: {
      roomId,
      staffId,
      cleanType: inferredCleanType,
      startedAt: new Date(),
    },
  });

  await prisma.room.update({
    where: { id: roomId },
    data: {
      status: RoomStatus.in_progress,
      updatedAt: new Date(),
    },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      type: 'room_clean_started',
      message: `Cleaning started for room ${room.roomNumber}`,
      data: { roomId, cleanType: inferredCleanType },
      staffId,
      roomId,
    },
  });

  try {
    emitRoomUpdate(roomId, 'in_progress', room.roomNumber, room.wingId);
    emitActivityEntry(
      'room_clean_started',
      `Cleaning started for room ${room.roomNumber}`,
      { roomId, cleanType: inferredCleanType },
      new Date()
    );
  } catch {
    // Socket may not be initialized
  }

  return cleanRecord;
}
