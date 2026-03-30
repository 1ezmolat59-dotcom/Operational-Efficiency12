import { Router, Response } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/roleCheck'
import { AuthRequest } from '../types'
import { getWeeklySchedule, setShift, getForecast, getSuggestions } from '../services/schedulingService'

export const router = Router()
router.use(authenticate)

const setShiftSchema = z.object({
  shiftType: z.enum(['day', 'evening', 'off', 'overtime']),
})

router.get('/', requireRole('supervisor', 'admin', 'nurse'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wingId = (req.query.wingId as string) || req.user!.wingId
    if (!wingId) { res.status(400).json({ error: 'wingId is required (query param or from user profile)', code: 'VALIDATION_ERROR' }); return }

    const weekStartParam = req.query.weekStart as string | undefined
    let weekStart: Date

    if (weekStartParam) {
      weekStart = new Date(weekStartParam)
      if (isNaN(weekStart.getTime())) { res.status(400).json({ error: 'Invalid weekStart date format', code: 'VALIDATION_ERROR' }); return }
    } else {
      weekStart = new Date()
      const day = weekStart.getDay()
      const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1)
      weekStart.setDate(diff)
    }

    weekStart.setHours(0, 0, 0, 0)
    const schedule = await getWeeklySchedule(wingId, weekStart)
    res.json({ schedule, weekStart: weekStart.toISOString() })
  } catch (error) {
    console.error('[Schedule] Get schedule error:', error)
    res.status(500).json({ error: 'Failed to fetch schedule', code: 'SERVER_ERROR' })
  }
})

router.get('/forecast', requireRole('supervisor', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string) || 7
    if (days < 1 || days > 30) { res.status(400).json({ error: 'days must be between 1 and 30', code: 'VALIDATION_ERROR' }); return }

    const forecast = await getForecast(days)
    res.json({ forecast })
  } catch (error) {
    console.error('[Schedule] Forecast error:', error)
    res.status(500).json({ error: 'Failed to generate forecast', code: 'SERVER_ERROR' })
  }
})

router.post('/suggestions', requireRole('supervisor', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate: startDateParam, endDate: endDateParam } = req.body
    const startDate = startDateParam ? new Date(startDateParam) : new Date()
    const endDate = endDateParam ? new Date(endDateParam) : new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) { res.status(400).json({ error: 'Invalid date format', code: 'VALIDATION_ERROR' }); return }

    const suggestions = await getSuggestions(startDate, endDate)
    res.json({ suggestions, analyzed: { startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0], daysAnalyzed: suggestions.length } })
  } catch (error) {
    console.error('[Schedule] Suggestions error:', error)
    res.status(500).json({ error: 'Failed to generate suggestions', code: 'SERVER_ERROR' })
  }
})

router.put('/:staffId/:date', requireRole('supervisor', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = setShiftSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message, code: 'VALIDATION_ERROR' }); return }

    const { staffId, date: dateParam } = req.params
    const date = new Date(dateParam)
    if (isNaN(date.getTime())) { res.status(400).json({ error: 'Invalid date format', code: 'VALIDATION_ERROR' }); return }

    const schedule = await setShift(staffId, date, parsed.data.shiftType)
    res.json({ schedule })
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: error.message, code: 'NOT_FOUND' }); return
    }
    console.error('[Schedule] Set shift error:', error)
    res.status(500).json({ error: 'Failed to update shift', code: 'SERVER_ERROR' })
  }
})
