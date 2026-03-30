import { Router, Response } from 'express'
import db from '../config/database'
import { authenticate } from '../middleware/auth'
import { AuthRequest } from '../types'

export const router = Router()

// GET /api/activity
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50
    const { data, error } = await db
      .from('ActivityLog')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(limit)
    if (error) throw error
    res.json(data || [])
  } catch (error) {
    console.error('[Activity] Get activity error:', error)
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' })
  }
})
