import db from '../config/database'
import { ChecklistStep } from '../types'

export function calculateScore(steps: ChecklistStep[]): number {
  if (!steps || steps.length === 0) return 0
  return (steps.filter((s) => s.checked).length / steps.length) * 100
}

export async function getComplianceRate(startDate: Date, endDate: Date): Promise<number> {
  const { data: records } = await db
    .from('CleanRecord')
    .select('id, stepsCompleted')
    .gte('completedAt', startDate.toISOString())
    .lte('completedAt', endDate.toISOString())
    .not('stepsCompleted', 'is', null)

  if (!records || records.length === 0) return 0
  const compliant = records.filter((r: any) => {
    const steps = r.stepsCompleted as ChecklistStep[] | null
    return steps && Array.isArray(steps) && calculateScore(steps) === 100
  }).length
  return (compliant / records.length) * 100
}

export async function getPhotoComplianceRate(startDate: Date, endDate: Date): Promise<number> {
  const { data: records } = await db
    .from('CleanRecord')
    .select('id, photos')
    .gte('completedAt', startDate.toISOString())
    .lte('completedAt', endDate.toISOString())

  if (!records || records.length === 0) return 0
  const withPhotos = records.filter((r: any) => Array.isArray(r.photos) && r.photos.length > 0).length
  return (withPhotos / records.length) * 100
}

export async function getDetailedComplianceReport(startDate: Date, endDate: Date) {
  const { data: records } = await db
    .from('CleanRecord')
    .select('*, staff:Staff(id,name)')
    .gte('completedAt', startDate.toISOString())
    .lte('completedAt', endDate.toISOString())
    .order('completedAt', { ascending: true })

  const overallRate = await getComplianceRate(startDate, endDate)
  const photoRate = await getPhotoComplianceRate(startDate, endDate)

  const byDateMap = new Map<string, { total: number; compliant: number; withPhoto: number }>()
  const byStaffMap = new Map<string, { name: string; scores: number[]; count: number }>()

  for (const record of records || []) {
    const dateKey = (record.completedAt || record.createdAt).split('T')[0]
    const steps = record.stepsCompleted as ChecklistStep[] | null
    const score = steps && Array.isArray(steps) ? calculateScore(steps) : 0
    const hasPhotos = Array.isArray(record.photos) && record.photos.length > 0

    const d = byDateMap.get(dateKey) || { total: 0, compliant: 0, withPhoto: 0 }
    d.total++
    if (score === 100) d.compliant++
    if (hasPhotos) d.withPhoto++
    byDateMap.set(dateKey, d)

    const s = byStaffMap.get(record.staffId) || { name: record.staff?.name || 'Unknown', scores: [] as number[], count: 0 }
    s.scores.push(score)
    s.count++
    byStaffMap.set(record.staffId, s)
  }

  const byDate = Array.from(byDateMap.entries()).map(([date, d]) => ({
    date,
    rate: d.total > 0 ? (d.compliant / d.total) * 100 : 0,
    photoRate: d.total > 0 ? (d.withPhoto / d.total) * 100 : 0,
    count: d.total,
  }))

  const byStaff = Array.from(byStaffMap.entries()).map(([staffId, s]) => ({
    staffId,
    staffName: s.name,
    avgScore: s.scores.length > 0 ? s.scores.reduce((a, b) => a + b, 0) / s.scores.length : 0,
    count: s.count,
  }))

  return { overallRate, photoRate, byDate, byStaff }
}
