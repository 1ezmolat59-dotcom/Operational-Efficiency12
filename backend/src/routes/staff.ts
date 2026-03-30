import { Router, Response } from 'express'
import db from '../config/database'
import { authenticate } from '../middleware/auth'
import { AuthRequest } from '../types'

export const router = Router()

// GET /api/staff
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, wingId } = req.query
    let query = db.from('Staff').select('*, wing:Wing(*)')

    if (role) query = query.eq('role', role as string)
    if (wingId) query = query.eq('wingId', wingId as string)

    const { data, error } = await query.order('name')
    if (error) throw error
    res.json(data || [])
  } catch (error) {
    console.error('[Staff] Get staff error:', error)
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' })
  }
})

// PATCH /api/staff/:staffId/availability
router.patch('/:staffId/availability', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { staffId } = req.params
    const { available } = req.body
    const { data, error } = await db
      .from('Staff')
      .update({ availabilityStatus: available })
      .eq('id', staffId)
      .select()
      .single()
    if (error) throw error
    res.json(data)
  } catch (error) {
    console.error('[Staff] Update availability error:', error)
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' })
  }
})
