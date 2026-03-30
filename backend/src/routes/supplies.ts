import { Router, Response } from 'express'
import { z } from 'zod'
import db from '../config/database'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/roleCheck'
import { AuthRequest } from '../types'
import { createAlert } from '../services/alertService'

export const router = Router()
router.use(authenticate)

const logSupplySchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  sheets: z.number().int().min(0).default(0),
  pillowcases: z.number().int().min(0).default(0),
  towels: z.number().int().min(0).default(0),
  gowns: z.number().int().min(0).default(0),
})

const flagSupplySchema = z.object({
  cartId: z.string().optional(),
  location: z.string().min(1, 'location is required'),
  items: z.array(z.string()).min(1, 'At least one item must be flagged'),
  notes: z.string().optional(),
})

router.post('/log', requireRole('housekeeper', 'supervisor', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = logSupplySchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message, code: 'VALIDATION_ERROR' }); return }

    const { roomId, sheets, pillowcases, towels, gowns } = parsed.data
    const staffId = req.user!.userId

    const { data: room } = await db.from('Room').select('id,roomNumber').eq('id', roomId).single()
    if (!room) { res.status(404).json({ error: 'Room not found', code: 'NOT_FOUND' }); return }

    const HIGH = { sheets: 5, pillowcases: 6, towels: 8, gowns: 4 }
    const isHighUsage = sheets > HIGH.sheets || pillowcases > HIGH.pillowcases || towels > HIGH.towels || gowns > HIGH.gowns

    const { data: supplyLog } = await db
      .from('SupplyLog')
      .insert({ staffId, roomId, sheets, pillowcases, towels, gowns, flaggedLow: false })
      .select('*, staff:Staff(id,name)')
      .single()

    await db.from('ActivityLog').insert({ type: 'supply_logged', message: `Supply usage logged for room ${room.roomNumber}`, data: { roomId, sheets, pillowcases, towels, gowns }, staffId, roomId })

    if (isHighUsage) {
      const items: string[] = []
      if (sheets > HIGH.sheets) items.push(`sheets (${sheets})`)
      if (pillowcases > HIGH.pillowcases) items.push(`pillowcases (${pillowcases})`)
      if (towels > HIGH.towels) items.push(`towels (${towels})`)
      if (gowns > HIGH.gowns) items.push(`gowns (${gowns})`)
      await createAlert({ type: 'linen_overage', severity: 'warning', message: `High linen usage in room ${room.roomNumber}: ${items.join(', ')}`, roomId, staffId })
    }

    res.status(201).json({ supplyLog })
  } catch (error) {
    console.error('[Supplies] Log error:', error)
    res.status(500).json({ error: 'Failed to log supply usage', code: 'SERVER_ERROR' })
  }
})

router.post('/flag', requireRole('housekeeper', 'transporter', 'supervisor', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = flagSupplySchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message, code: 'VALIDATION_ERROR' }); return }

    const { location, items, notes, cartId } = parsed.data
    const staffId = req.user!.userId

    const { data: staff } = await db.from('Staff').select('name').eq('id', staffId).single()
    const message = `Supply cart${cartId ? ` #${cartId}` : ''} at ${location} is low on: ${items.join(', ')}. Reported by ${staff?.name}.${notes ? ` Notes: ${notes}` : ''}`

    const alert = await createAlert({ type: 'linen_overage', severity: 'warning', message, staffId })
    await db.from('ActivityLog').insert({ type: 'supply_flagged', message: `Supply cart flagged as low at ${location}`, data: { location, items, cartId, notes }, staffId })

    res.status(201).json({ alert, message: 'Supply cart flagged. Supervisor has been notified.' })
  } catch (error) {
    console.error('[Supplies] Flag error:', error)
    res.status(500).json({ error: 'Failed to flag supply cart', code: 'SERVER_ERROR' })
  }
})

router.get('/logs', requireRole('supervisor', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const roomId = req.query.roomId as string | undefined

    let query = db.from('SupplyLog').select('*, staff:Staff(id,name,role)', { count: 'exact' }).order('createdAt', { ascending: false }).range((page - 1) * limit, page * limit - 1)
    if (roomId) query = query.eq('roomId', roomId)

    const { data: logs, count } = await query
    res.json({ logs, pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) } })
  } catch (error) {
    console.error('[Supplies] Get logs error:', error)
    res.status(500).json({ error: 'Failed to fetch supply logs', code: 'SERVER_ERROR' })
  }
})
