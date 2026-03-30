import { Router, Response } from 'express'
import { z } from 'zod'
import db from '../config/database'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/roleCheck'
import { AuthRequest, ChecklistStep } from '../types'
import { getTaskQueue, completeRoom, assignPatient, getRoomStatus, startClean } from '../services/roomService'

export const router = Router()
router.use(authenticate)

const startCleanSchema = z.object({
  cleanType: z.enum(['discharge', 'checkout', 'routine']).optional(),
})

const completeRoomSchema = z.object({
  steps: z.array(z.object({ id: z.string(), label: z.string(), checked: z.boolean(), required: z.boolean() })).min(1, 'At least one step is required'),
  photos: z.array(z.string()).default([]),
  staffId: z.string().min(1, 'staffId is required'),
})

const assignPatientSchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  patientName: z.string().min(1, 'patientName is required'),
})

router.get('/', requireRole('supervisor', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wingId = req.query.wingId as string | undefined
    const rooms = await getRoomStatus(wingId)
    res.json({ rooms })
  } catch (error) {
    console.error('[Rooms] List error:', error)
    res.status(500).json({ error: 'Failed to fetch rooms', code: 'SERVER_ERROR' })
  }
})

router.get('/queue', requireRole('housekeeper', 'supervisor', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const staffId = req.user!.userId
    const queue = await getTaskQueue(staffId)
    res.json(queue)
  } catch (error) {
    console.error('[Rooms] Queue error:', error)
    res.status(500).json({ error: 'Failed to fetch task queue', code: 'SERVER_ERROR' })
  }
})

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: room } = await db
      .from('Room')
      .select('*, wing:Wing(*), cleanRecords:CleanRecord(*, staff:Staff(id,name,role))')
      .eq('id', req.params.id)
      .order('createdAt', { ascending: false, referencedTable: 'CleanRecord' })
      .limit(1, { referencedTable: 'CleanRecord' })
      .single()

    if (!room) { res.status(404).json({ error: 'Room not found', code: 'NOT_FOUND' }); return }

    const user = req.user!
    const canSeePHI = ['nurse', 'supervisor', 'admin'].includes(user.role)
    const response = { ...room, patientName: canSeePHI ? room.patientName : undefined, currentPatientId: canSeePHI ? room.currentPatientId : undefined }

    res.json({ room: response })
  } catch (error) {
    console.error('[Rooms] Get room error:', error)
    res.status(500).json({ error: 'Failed to fetch room', code: 'SERVER_ERROR' })
  }
})

router.post('/:id/start-clean', requireRole('housekeeper'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = startCleanSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message, code: 'VALIDATION_ERROR' }); return }

    const staffId = req.user!.userId
    const cleanRecord = await startClean(req.params.id, staffId, parsed.data.cleanType)

    res.status(201).json({ cleanRecord })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('already being cleaned') || error.message.includes('occupied')) {
        res.status(409).json({ error: error.message, code: 'CONFLICT' }); return
      }
      if (error.message === 'Room not found') {
        res.status(404).json({ error: error.message, code: 'NOT_FOUND' }); return
      }
    }
    console.error('[Rooms] Start clean error:', error)
    res.status(500).json({ error: 'Failed to start clean', code: 'SERVER_ERROR' })
  }
})

router.post('/:id/complete', requireRole('housekeeper'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = completeRoomSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message, code: 'VALIDATION_ERROR', details: parsed.error.errors }); return }

    const data = { steps: parsed.data.steps as ChecklistStep[], photos: parsed.data.photos, staffId: parsed.data.staffId }

    if (data.staffId !== req.user!.userId) { res.status(403).json({ error: 'staffId does not match authenticated user', code: 'FORBIDDEN' }); return }

    const cleanRecord = await completeRoom(req.params.id, data)
    res.json({ cleanRecord })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Room not found') { res.status(404).json({ error: error.message, code: 'NOT_FOUND' }); return }
      if (error.message.includes('No active clean record')) { res.status(409).json({ error: error.message, code: 'CONFLICT' }); return }
    }
    console.error('[Rooms] Complete error:', error)
    res.status(500).json({ error: 'Failed to complete room clean', code: 'SERVER_ERROR' })
  }
})

router.post('/:id/assign', requireRole('nurse', 'supervisor'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = assignPatientSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message, code: 'VALIDATION_ERROR' }); return }

    const { patientId, patientName } = parsed.data
    const nurseId = req.user!.userId
    const room = await assignPatient(req.params.id, patientId, patientName, nurseId)
    res.json({ room })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Room not found') { res.status(404).json({ error: error.message, code: 'NOT_FOUND' }); return }
      if (error.message.includes('not clean and ready')) { res.status(409).json({ error: error.message, code: 'CONFLICT' }); return }
    }
    console.error('[Rooms] Assign error:', error)
    res.status(500).json({ error: 'Failed to assign patient', code: 'SERVER_ERROR' })
  }
})

router.get('/:id/audit', requireRole('supervisor', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: room } = await db.from('Room').select('id,roomNumber').eq('id', req.params.id).single()
    if (!room) { res.status(404).json({ error: 'Room not found', code: 'NOT_FOUND' }); return }

    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const { data: cleanRecords, count } = await db
      .from('CleanRecord')
      .select('*, staff:Staff(id,name,role)', { count: 'exact' })
      .eq('roomId', req.params.id)
      .order('createdAt', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    res.json({ room, cleanRecords, pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) } })
  } catch (error) {
    console.error('[Rooms] Audit error:', error)
    res.status(500).json({ error: 'Failed to fetch audit trail', code: 'SERVER_ERROR' })
  }
})
