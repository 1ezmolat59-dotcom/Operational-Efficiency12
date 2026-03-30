import { Router, Response } from 'express'
import db from '../config/database'
import { authenticate } from '../middleware/auth'
import { AuthRequest } from '../types'
import { resolveAlert } from '../services/alertService'

export const router = Router()

// GET /api/alerts
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { resolved } = req.query
    let query = db.from('Alert').select('*').order('createdAt', { ascending: false })

    if (resolved !== undefined) {
      query = query.eq('resolved', resolved === 'true')
    }

    const { data, error } = await query
    if (error) throw error
    res.json(data || [])
  } catch (error) {
    console.error('[Alerts] Get alerts error:', error)
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' })
  }
})

// POST /api/alerts/:alertId/resolve
router.post('/:alertId/resolve', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const alert = await resolveAlert(req.params.alertId)
    res.json(alert)
  } catch (error) {
    console.error('[Alerts] Resolve alert error:', error)
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' })
  }
})
