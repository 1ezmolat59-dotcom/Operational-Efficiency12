import { AlertType, AlertSeverity } from '@prisma/client';
import prisma from '../config/database';
import { emitAlert, emitAlertResolved } from '../socket';

interface CreateAlertData {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  roomId?: string;
  staffId?: string;
  jobId?: string;
}

export async function createAlert(data: CreateAlertData) {
  try {
    const alert = await prisma.alert.create({
      data: {
        type: data.type,
        severity: data.severity,
        message: data.message,
        roomId: data.roomId,
        staffId: data.staffId,
        jobId: data.jobId,
        resolved: false,
      },
    });

    // Log to activity log
    await prisma.activityLog.create({
      data: {
        type: 'alert_created',
        message: `Alert created: ${data.message}`,
        data: { alertId: alert.id, type: data.type, severity: data.severity },
        roomId: data.roomId,
        staffId: data.staffId,
        jobId: data.jobId,
      },
    });

    // Emit real-time event
    try {
      emitAlert(alert);
    } catch {
      // Socket may not be initialized in test environments
    }

    return alert;
  } catch (error) {
    console.error('[AlertService] Failed to create alert:', error);
    throw error;
  }
}

export async function resolveAlert(alertId: string) {
  const alert = await prisma.alert.update({
    where: { id: alertId },
    data: { resolved: true },
  });

  try {
    emitAlertResolved(alertId);
  } catch {
    // Socket may not be initialized
  }

  return alert;
}

export async function getActiveAlerts() {
  const alerts = await prisma.alert.findMany({
    where: { resolved: false },
    orderBy: [
      {
        severity: 'desc',
      },
      {
        createdAt: 'desc',
      },
    ],
  });

  // Sort by severity manually: critical > warning > info
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort(
    (a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3)
  );
}

export async function checkBedUnassigned(): Promise<void> {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  const unassignedCleanRooms = await prisma.room.findMany({
    where: {
      status: 'clean_ready',
      currentPatientId: null,
      updatedAt: { lte: thirtyMinutesAgo },
    },
  });

  for (const room of unassignedCleanRooms) {
    // Check if there's already an unresolved alert for this room
    const existingAlert = await prisma.alert.findFirst({
      where: {
        type: 'bed_unassigned',
        roomId: room.id,
        resolved: false,
      },
    });

    if (!existingAlert) {
      await createAlert({
        type: AlertType.bed_unassigned,
        severity: AlertSeverity.warning,
        message: `Room ${room.roomNumber} has been clean and ready for over 30 minutes with no patient assigned.`,
        roomId: room.id,
      });
    }
  }
}

export async function checkStaffNoShow(): Promise<void> {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  const now = new Date();

  // Find staff who are scheduled (shift started) but have no recent activity
  const scheduledStaff = await prisma.staff.findMany({
    where: {
      availabilityStatus: true,
      shiftStart: { lte: now },
      shiftEnd: { gte: now },
    },
  });

  for (const staff of scheduledStaff) {
    // Check for recent clean records or transport jobs
    const recentClean = await prisma.cleanRecord.findFirst({
      where: {
        staffId: staff.id,
        startedAt: { gte: thirtyMinutesAgo },
      },
    });

    const recentTransport = await prisma.transportJob.findFirst({
      where: {
        assignedTo: staff.id,
        updatedAt: { gte: thirtyMinutesAgo },
      },
    });

    if (!recentClean && !recentTransport) {
      const existingAlert = await prisma.alert.findFirst({
        where: {
          type: 'staff_no_show',
          staffId: staff.id,
          resolved: false,
          createdAt: { gte: thirtyMinutesAgo },
        },
      });

      if (!existingAlert) {
        await createAlert({
          type: AlertType.staff_no_show,
          severity: AlertSeverity.warning,
          message: `Staff member ${staff.name} has been on shift with no activity for over 30 minutes.`,
          staffId: staff.id,
        });
      }
    }
  }
}
