import db from '../config/database'
import { ForecastDay, StaffingSuggestion } from '../types'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export async function getForecast(days: number = 7): Promise<ForecastDay[]> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: records } = await db
    .from('CleanRecord')
    .select('startedAt')
    .gte('startedAt', ninetyDaysAgo)
    .not('completedAt', 'is', null)

  const dayWeightedCounts = new Array(7).fill(0)
  const dayTotalWeeks = new Array(7).fill(0)

  for (const record of records || []) {
    const dow = new Date(record.startedAt).getDay()
    const isRecent = record.startedAt >= thirtyDaysAgo
    const weight = isRecent ? 2 : 1
    dayWeightedCounts[dow] += weight
    dayTotalWeeks[dow] += weight
  }

  const weeksIn90 = 90 / 7
  const avgTasksPerDow = dayWeightedCounts.map((count, i) => {
    const totalWeight = dayTotalWeeks[i]
    if (totalWeight === 0) return 2
    return count / (weeksIn90 * 1.5)
  })

  const forecast: ForecastDay[] = []
  const today = new Date()
  for (let i = 0; i < days; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    const dow = date.getDay()
    const predictedTasks = Math.max(1, Math.round(avgTasksPerDow[dow]))
    forecast.push({
      date: date.toISOString().split('T')[0],
      dayOfWeek: DAY_NAMES[dow],
      predictedTasks,
      recommendedStaff: Math.max(1, Math.ceil(predictedTasks / 8)),
    })
  }
  return forecast
}

export async function getSuggestions(startDate: Date, endDate: Date): Promise<StaffingSuggestion[]> {
  const forecast = await getForecast(7)
  const suggestions: StaffingSuggestion[] = []

  for (const forecastDay of forecast) {
    const dateStart = new Date(forecastDay.date + 'T00:00:00Z').toISOString()
    const dateEnd = new Date(forecastDay.date + 'T23:59:59Z').toISOString()

    const { data: scheduledStaff } = await db
      .from('Schedule')
      .select('*, staff:Staff(id,name,role)')
      .gte('date', dateStart)
      .lte('date', dateEnd)
      .in('shiftType', ['day', 'evening', 'overtime'])

    const activeSchedules = (scheduledStaff || []).filter(
      (s: any) => s.staff.role === 'housekeeper' || s.staff.role === 'transporter'
    )
    const currentStaffCount = activeSchedules.length
    const requiredStaffCount = forecastDay.recommendedStaff
    const capacityRatio = requiredStaffCount > 0 ? currentStaffCount / requiredStaffCount : 1

    if (capacityRatio < 0.85) {
      const gap = requiredStaffCount - currentStaffCount

      const { data: offStaff } = await db
        .from('Schedule')
        .select('*, staff:Staff(id,name,role)')
        .gte('date', dateStart)
        .lte('date', dateEnd)
        .eq('shiftType', 'off')

      const { data: allHousekeepers } = await db
        .from('Staff')
        .select('*')
        .in('role', ['housekeeper', 'transporter'])
        .eq('availabilityStatus', true)

      const scheduledIds = new Set(activeSchedules.map((s: any) => s.staffId))
      const unscheduled = (allHousekeepers || []).filter((s: any) => !scheduledIds.has(s.id))

      const suggestedChanges: StaffingSuggestion['suggestedChanges'] = []

      for (const off of (offStaff || []).slice(0, gap)) {
        suggestedChanges.push({
          staffId: off.staffId,
          staffName: off.staff.name,
          currentShift: 'off',
          suggestedShift: 'day',
          reason: `High predicted demand on ${forecastDay.dayOfWeek} (${forecastDay.predictedTasks} tasks expected)`,
        })
      }

      const remainingGap = gap - suggestedChanges.length
      for (const staff of unscheduled.slice(0, remainingGap)) {
        suggestedChanges.push({
          staffId: staff.id,
          staffName: staff.name,
          currentShift: null,
          suggestedShift: 'day',
          reason: `Understaffed on ${forecastDay.dayOfWeek} (${currentStaffCount}/${requiredStaffCount} required)`,
        })
      }

      suggestions.push({ date: forecastDay.date, currentStaffCount, requiredStaffCount, gap, suggestedChanges })
    }
  }

  return suggestions
}

export async function getWeeklySchedule(wingId: string, weekStart: Date) {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const { data: staff } = await db.from('Staff').select('id,name,role').eq('wingId', wingId)

  const { data: schedules } = await db
    .from('Schedule')
    .select('*')
    .gte('date', weekStart.toISOString())
    .lte('date', weekEnd.toISOString())
    .in('staffId', (staff || []).map((s: any) => s.id))
    .order('date', { ascending: true })

  return (staff || []).map((member: any) => ({
    staffId: member.id,
    name: member.name,
    role: member.role,
    schedules: (schedules || []).filter((s: any) => s.staffId === member.id),
  }))
}

export async function setShift(staffId: string, date: Date, shiftType: string) {
  const dateOnly = new Date(date)
  dateOnly.setHours(0, 0, 0, 0)

  const { data: staff } = await db.from('Staff').select('id').eq('id', staffId).single()
  if (!staff) throw new Error('Staff not found')

  const { data: existing } = await db
    .from('Schedule')
    .select('id')
    .eq('staffId', staffId)
    .eq('date', dateOnly.toISOString())
    .single()

  if (existing) {
    const { data } = await db
      .from('Schedule')
      .update({ shiftType })
      .eq('id', existing.id)
      .select('*, staff:Staff(id,name,role)')
      .single()
    return data
  } else {
    const { data } = await db
      .from('Schedule')
      .insert({ staffId, date: dateOnly.toISOString(), shiftType })
      .select('*, staff:Staff(id,name,role)')
      .single()
    return data
  }
}
