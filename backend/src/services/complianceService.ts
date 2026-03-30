import prisma from '../config/database';
import { ChecklistStep } from '../types';

export function calculateScore(steps: ChecklistStep[]): number {
  if (!steps || steps.length === 0) return 0;
  const checkedCount = steps.filter((step) => step.checked).length;
  return (checkedCount / steps.length) * 100;
}

export async function getComplianceRate(
  startDate: Date,
  endDate: Date
): Promise<number> {
  const records = await prisma.cleanRecord.findMany({
    where: {
      completedAt: {
        gte: startDate,
        lte: endDate,
      },
      stepsCompleted: { not: null },
    },
    select: {
      id: true,
      stepsCompleted: true,
    },
  });

  if (records.length === 0) return 0;

  let compliantCount = 0;
  for (const record of records) {
    const steps = record.stepsCompleted as ChecklistStep[] | null;
    if (steps && Array.isArray(steps)) {
      const score = calculateScore(steps);
      if (score === 100) {
        compliantCount++;
      }
    }
  }

  return (compliantCount / records.length) * 100;
}

export async function getPhotoComplianceRate(
  startDate: Date,
  endDate: Date
): Promise<number> {
  const records = await prisma.cleanRecord.findMany({
    where: {
      completedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      id: true,
      photos: true,
    },
  });

  if (records.length === 0) return 0;

  const withPhotos = records.filter((record) => {
    const photos = record.photos as string[] | null;
    return photos && Array.isArray(photos) && photos.length > 0;
  });

  return (withPhotos.length / records.length) * 100;
}

export async function getDetailedComplianceReport(
  startDate: Date,
  endDate: Date
): Promise<{
  overallRate: number;
  photoRate: number;
  byDate: Array<{ date: string; rate: number; photoRate: number; count: number }>;
  byStaff: Array<{ staffId: string; staffName: string; avgScore: number; count: number }>;
}> {
  const records = await prisma.cleanRecord.findMany({
    where: {
      completedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      staff: { select: { id: true, name: true } },
    },
    orderBy: { completedAt: 'asc' },
  });

  const overallRate = await getComplianceRate(startDate, endDate);
  const photoRate = await getPhotoComplianceRate(startDate, endDate);

  // Group by date
  const byDateMap = new Map<
    string,
    { total: number; compliant: number; withPhoto: number }
  >();
  const byStaffMap = new Map<
    string,
    { name: string; scores: number[]; count: number }
  >();

  for (const record of records) {
    const dateKey = record.completedAt
      ? record.completedAt.toISOString().split('T')[0]
      : record.createdAt.toISOString().split('T')[0];

    const steps = record.stepsCompleted as ChecklistStep[] | null;
    const score = steps && Array.isArray(steps) ? calculateScore(steps) : 0;
    const photos = record.photos as string[] | null;
    const hasPhotos = photos && Array.isArray(photos) && photos.length > 0;

    // By date
    const existing = byDateMap.get(dateKey) || { total: 0, compliant: 0, withPhoto: 0 };
    existing.total++;
    if (score === 100) existing.compliant++;
    if (hasPhotos) existing.withPhoto++;
    byDateMap.set(dateKey, existing);

    // By staff
    const staffEntry = byStaffMap.get(record.staffId) || {
      name: record.staff.name,
      scores: [],
      count: 0,
    };
    staffEntry.scores.push(score);
    staffEntry.count++;
    byStaffMap.set(record.staffId, staffEntry);
  }

  const byDate = Array.from(byDateMap.entries()).map(([date, data]) => ({
    date,
    rate: data.total > 0 ? (data.compliant / data.total) * 100 : 0,
    photoRate: data.total > 0 ? (data.withPhoto / data.total) * 100 : 0,
    count: data.total,
  }));

  const byStaff = Array.from(byStaffMap.entries()).map(([staffId, data]) => ({
    staffId,
    staffName: data.name,
    avgScore:
      data.scores.length > 0
        ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
        : 0,
    count: data.count,
  }));

  return { overallRate, photoRate, byDate, byStaff };
}
