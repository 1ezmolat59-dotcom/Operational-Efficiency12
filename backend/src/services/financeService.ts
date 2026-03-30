import prisma from '../config/database';

const EVS_HOURLY_RATE = parseFloat(process.env.EVS_HOURLY_RATE || '18');
const TRANSPORT_HOURLY_RATE = parseFloat(process.env.TRANSPORT_HOURLY_RATE || '20');

export async function getCostPerTask(
  startDate: Date,
  endDate: Date
): Promise<{
  totalCost: number;
  totalTasks: number;
  avgCostPerTask: number;
  breakdown: Array<{ staffId: string; staffName: string; hours: number; tasks: number; cost: number }>;
}> {
  const records = await prisma.cleanRecord.findMany({
    where: {
      completedAt: {
        gte: startDate,
        lte: endDate,
      },
      duration: { not: null },
    },
    include: {
      staff: { select: { id: true, name: true } },
    },
  });

  const staffMap = new Map<
    string,
    { name: string; totalMinutes: number; tasks: number }
  >();

  for (const record of records) {
    const entry = staffMap.get(record.staffId) || {
      name: record.staff.name,
      totalMinutes: 0,
      tasks: 0,
    };
    entry.totalMinutes += record.duration || 0;
    entry.tasks++;
    staffMap.set(record.staffId, entry);
  }

  const breakdown = Array.from(staffMap.entries()).map(([staffId, data]) => {
    const hours = data.totalMinutes / 60;
    const cost = hours * EVS_HOURLY_RATE;
    return { staffId, staffName: data.name, hours, tasks: data.tasks, cost };
  });

  const totalCost = breakdown.reduce((sum, b) => sum + b.cost, 0);
  const totalTasks = breakdown.reduce((sum, b) => sum + b.tasks, 0);
  const avgCostPerTask = totalTasks > 0 ? totalCost / totalTasks : 0;

  return { totalCost, totalTasks, avgCostPerTask, breakdown };
}

export async function getCostPerTransport(
  startDate: Date,
  endDate: Date
): Promise<{
  totalCost: number;
  totalJobs: number;
  avgCostPerJob: number;
  breakdown: Array<{ staffId: string; staffName: string; hours: number; jobs: number; cost: number }>;
}> {
  const jobs = await prisma.transportJob.findMany({
    where: {
      status: 'complete',
      updatedAt: {
        gte: startDate,
        lte: endDate,
      },
      assignedTo: { not: null },
    },
    include: {
      assignee: { select: { id: true, name: true } },
    },
  });

  const staffMap = new Map<
    string,
    { name: string; totalMinutes: number; jobs: number }
  >();

  for (const job of jobs) {
    if (!job.assignedTo || !job.assignee) continue;

    const timestamps = job.timestamps as Record<string, string>;
    let durationMinutes = 30; // default estimate

    if (timestamps.accepted && timestamps.completed) {
      const start = new Date(timestamps.accepted).getTime();
      const end = new Date(timestamps.completed).getTime();
      durationMinutes = (end - start) / (1000 * 60);
    }

    const entry = staffMap.get(job.assignedTo) || {
      name: job.assignee.name,
      totalMinutes: 0,
      jobs: 0,
    };
    entry.totalMinutes += durationMinutes;
    entry.jobs++;
    staffMap.set(job.assignedTo, entry);
  }

  const breakdown = Array.from(staffMap.entries()).map(([staffId, data]) => {
    const hours = data.totalMinutes / 60;
    const cost = hours * TRANSPORT_HOURLY_RATE;
    return { staffId, staffName: data.name, hours, jobs: data.jobs, cost };
  });

  const totalCost = breakdown.reduce((sum, b) => sum + b.cost, 0);
  const totalJobs = breakdown.reduce((sum, b) => sum + b.jobs, 0);
  const avgCostPerJob = totalJobs > 0 ? totalCost / totalJobs : 0;

  return { totalCost, totalJobs, avgCostPerJob, breakdown };
}

export async function getOvertimeRate(
  startDate: Date,
  endDate: Date
): Promise<{
  overtimeHours: number;
  scheduledHours: number;
  overtimeRate: number;
  overtimeCost: number;
}> {
  const schedules = await prisma.schedule.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  let scheduledHours = 0;
  let overtimeHours = 0;

  for (const schedule of schedules) {
    if (schedule.shiftType === 'day' || schedule.shiftType === 'evening') {
      scheduledHours += 8;
    } else if (schedule.shiftType === 'overtime') {
      scheduledHours += 8;
      overtimeHours += 4; // Assume 4 hours of overtime on overtime shifts
    }
  }

  const overtimeRate = scheduledHours > 0 ? (overtimeHours / scheduledHours) * 100 : 0;
  // Overtime typically at 1.5x rate; use blended rate
  const overtimeCost = overtimeHours * ((EVS_HOURLY_RATE + TRANSPORT_HOURLY_RATE) / 2) * 1.5;

  return { overtimeHours, scheduledHours, overtimeRate, overtimeCost };
}

export async function getTransportResponseTime(
  startDate: Date,
  endDate: Date
): Promise<{ avgMinutes: number; acceptanceRate: number }> {
  const jobs = await prisma.transportJob.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      status: { not: 'cancelled' },
    },
  });

  if (jobs.length === 0) return { avgMinutes: 0, acceptanceRate: 0 };

  let totalResponseMinutes = 0;
  let acceptedCount = 0;

  for (const job of jobs) {
    const timestamps = job.timestamps as Record<string, string>;
    if (timestamps.accepted) {
      const created = job.createdAt.getTime();
      const accepted = new Date(timestamps.accepted).getTime();
      totalResponseMinutes += (accepted - created) / (1000 * 60);
      acceptedCount++;
    }
  }

  const relevantJobs = jobs.filter((j) => j.status !== 'requested');
  const avgMinutes = acceptedCount > 0 ? totalResponseMinutes / acceptedCount : 0;
  const acceptanceRate = relevantJobs.length > 0 ? (acceptedCount / relevantJobs.length) * 100 : 0;

  return { avgMinutes, acceptanceRate };
}
