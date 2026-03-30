import prisma from '../config/database';
import { ShiftType } from '@prisma/client';
import { ForecastDay, StaffingSuggestion } from '../types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function getForecast(days: number = 7): Promise<ForecastDay[]> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Fetch all clean records from the last 90 days
  const records = await prisma.cleanRecord.findMany({
    where: {
      startedAt: { gte: ninetyDaysAgo },
      completedAt: { not: null },
    },
    select: {
      startedAt: true,
    },
  });

  // Group by day of week (0=Sunday ... 6=Saturday)
  // Weight recent 30 days 2x
  const dayWeightedCounts: number[] = new Array(7).fill(0);
  const dayTotalWeeks: number[] = new Array(7).fill(0);

  for (const record of records) {
    const dow = record.startedAt.getDay();
    const isRecent = record.startedAt >= thirtyDaysAgo;
    const weight = isRecent ? 2 : 1;
    dayWeightedCounts[dow] += weight;
    dayTotalWeeks[dow] += weight;
  }

  // Calculate number of weeks in each window
  const totalDays90 = 90;
  const weeksIn90 = totalDays90 / 7;

  // Average tasks per day of week (weighted)
  const avgTasksPerDow: number[] = dayWeightedCounts.map((count, i) => {
    const totalWeight = dayTotalWeeks[i];
    if (totalWeight === 0) return 2; // Default if no data
    // Each day of week appears ~weeksIn90 times in 90 days, but recent ones are weighted 2x
    return count / (weeksIn90 * 1.5); // Approximate divisor for weighted average
  });

  // Generate forecast for the next N days
  const forecast: ForecastDay[] = [];
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dow = date.getDay();
    const predictedTasks = Math.max(1, Math.round(avgTasksPerDow[dow]));
    // Assume 1 housekeeper can handle ~8 tasks per shift
    const recommendedStaff = Math.max(1, Math.ceil(predictedTasks / 8));

    forecast.push({
      date: date.toISOString().split('T')[0],
      dayOfWeek: DAY_NAMES[dow],
      predictedTasks,
      recommendedStaff,
    });
  }

  return forecast;
}

export async function getSuggestions(
  startDate: Date,
  endDate: Date
): Promise<StaffingSuggestion[]> {
  const forecast = await getForecast(7);

  const suggestions: StaffingSuggestion[] = [];

  for (const forecastDay of forecast) {
    const date = new Date(forecastDay.date);
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    // Count currently scheduled housekeepers for this day
    const scheduledStaff = await prisma.schedule.findMany({
      where: {
        date: {
          gte: dateStart,
          lte: dateEnd,
        },
        shiftType: { in: [ShiftType.day, ShiftType.evening, ShiftType.overtime] },
      },
      include: {
        staff: { select: { id: true, name: true, role: true } },
      },
    });

    const activeSchedules = scheduledStaff.filter(
      (s) => s.staff.role === 'housekeeper' || s.staff.role === 'transporter'
    );
    const currentStaffCount = activeSchedules.length;
    const requiredStaffCount = forecastDay.recommendedStaff;

    // Check if below 85% capacity
    const capacityRatio = requiredStaffCount > 0 ? currentStaffCount / requiredStaffCount : 1;

    if (capacityRatio < 0.85) {
      const gap = requiredStaffCount - currentStaffCount;

      // Find staff who are off or not scheduled
      const offStaff = await prisma.schedule.findMany({
        where: {
          date: {
            gte: dateStart,
            lte: dateEnd,
          },
          shiftType: ShiftType.off,
        },
        include: {
          staff: { select: { id: true, name: true, role: true } },
        },
      });

      // Find housekeepers with no schedule for this day
      const allHousekeepers = await prisma.staff.findMany({
        where: {
          role: { in: ['housekeeper', 'transporter'] },
          availabilityStatus: true,
        },
      });

      const scheduledIds = new Set(activeSchedules.map((s) => s.staffId));
      const unscheduledStaff = allHousekeepers.filter((s) => !scheduledIds.has(s.id));

      const suggestedChanges: StaffingSuggestion['suggestedChanges'] = [];

      // First suggest changing off-shifts to day shifts
      for (const offSchedule of offStaff.slice(0, gap)) {
        suggestedChanges.push({
          staffId: offSchedule.staffId,
          staffName: offSchedule.staff.name,
          currentShift: ShiftType.off,
          suggestedShift: ShiftType.day,
          reason: `High predicted demand on ${forecastDay.dayOfWeek} (${forecastDay.predictedTasks} tasks expected)`,
        });
      }

      // Then suggest adding unscheduled staff
      const remainingGap = gap - suggestedChanges.length;
      for (const staff of unscheduledStaff.slice(0, remainingGap)) {
        suggestedChanges.push({
          staffId: staff.id,
          staffName: staff.name,
          currentShift: null,
          suggestedShift: ShiftType.day,
          reason: `Understaffed on ${forecastDay.dayOfWeek} (${currentStaffCount}/${requiredStaffCount} required staff)`,
        });
      }

      // Suggest overtime for existing staff if still not enough
      const stillMissingGap = gap - suggestedChanges.length;
      if (stillMissingGap > 0) {
        for (const schedule of activeSchedules.slice(0, stillMissingGap)) {
          suggestedChanges.push({
            staffId: schedule.staffId,
            staffName: schedule.staff.name,
            currentShift: schedule.shiftType as ShiftType,
            suggestedShift: ShiftType.overtime,
            reason: `Insufficient staff coverage, overtime recommended`,
          });
        }
      }

      suggestions.push({
        date: forecastDay.date,
        currentStaffCount,
        requiredStaffCount,
        gap,
        suggestedChanges,
      });
    }
  }

  return suggestions;
}

export async function getWeeklySchedule(wingId: string, weekStart: Date) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const staff = await prisma.staff.findMany({
    where: { wingId },
    include: {
      schedules: {
        where: {
          date: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
        orderBy: { date: 'asc' },
      },
    },
  });

  return staff.map((member) => ({
    staffId: member.id,
    name: member.name,
    role: member.role,
    schedules: member.schedules,
  }));
}

export async function setShift(
  staffId: string,
  date: Date,
  shiftType: ShiftType
) {
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  return prisma.schedule.upsert({
    where: {
      staffId_date: {
        staffId,
        date: dateOnly,
      },
    },
    update: { shiftType },
    create: {
      staffId,
      date: dateOnly,
      shiftType,
    },
    include: {
      staff: { select: { id: true, name: true, role: true } },
    },
  });
}
