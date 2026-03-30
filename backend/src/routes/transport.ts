import { Router, Response } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/roleCheck'
import { AuthRequest } from '../types'
import { createJob, acceptJob, updateJobStatus, getJobWithHistory, listJobs } from '../services/transportService'

export const router = Router()
router.use(authenticate)

const createJobSchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  patientName: z.string().min(1, 'patientName is required'),
  fromLocation: z.string().min(1, 'fromLocation is required'),
  toLocation: z.string().min(1, 'toLocation is required'),
  roomId: z.string().optional(),
  equipment: z.enum(['wheelchair', 'stretcher', 'none']).default('none'),
  priority: z.enum(['stat', 'routine']).default('routine'),
  jobType: z.enum(['stat', 'radiology', 'discharge', 'routine']).default('routine'),
})

const updateStatusSchema = z.object({
  status: z.enum(['accepted', 'in_progress', 'complete', 'cancelled']),
})

router.get('/jobs', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!
    const statusFilter = req.query.status as string | undefined
    const assignedToFilter = req.query.assignedTo as string | undefined

    const jobs = await listJobs(user.userId, user.role, statusFilter, assignedToFilter)

    const canSeePHI = ['supervisor', 'admin', 'nurse'].includes(user.role)
    const sanitizedJobs = jobs.map((job) => ({
      ...job,
      patientName: canSeePHI ? job.patientName : `Patient #${job.patientId.slice(-4)}`,
    }))

    res.json({ jobs: sanitizedJobs })
  } catch (error) {
    console.error('[Transport] List jobs error:', error)
    res.status(500).json({ error: 'Failed to fetch jobs', code: 'SERVER_ERROR' })
  }
})

router.post('/jobs', requireRole('nurse', 'supervisor', 'admin', 'transporter'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = createJobSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message, code: 'VALIDATION_ERROR', details: parsed.error.errors }); return }

    const job = await createJob({ ...parsed.data, requestedBy: req.user!.userId })
    res.status(201).json({ job })
  } catch (error) {
    if (error instanceof Error && error.message === 'Requester not found') {
      res.status(404).json({ error: error.message, code: 'NOT_FOUND' }); return
    }
    console.error('[Transport] Create job error:', error)
    res.status(500).json({ error: 'Failed to create transport job', code: 'SERVER_ERROR' })
  }
})

router.patch('/jobs/:id/accept', requireRole('transporter'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const job = await acceptJob(req.params.id, req.user!.userId)
    res.json({ job })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Job not found') { res.status(404).json({ error: error.message, code: 'NOT_FOUND' }); return }
      if (error.message.includes('not assigned') || error.message.includes('cannot be accepted')) {
        res.status(409).json({ error: error.message, code: 'CONFLICT' }); return
      }
    }
    console.error('[Transport] Accept job error:', error)
    res.status(500).json({ error: 'Failed to accept job', code: 'SERVER_ERROR' })
  }
})

router.patch('/jobs/:id/status', requireRole('transporter', 'supervisor', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = updateStatusSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message, code: 'VALIDATION_ERROR' }); return }

    const job = await updateJobStatus(req.params.id, parsed.data.status, req.user!.userId)
    res.json({ job })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Job not found') { res.status(404).json({ error: error.message, code: 'NOT_FOUND' }); return }
      if (error.message.includes('not assigned') || error.message.includes('Cannot transition')) {
        res.status(409).json({ error: error.message, code: 'CONFLICT' }); return
      }
    }
    console.error('[Transport] Update status error:', error)
    res.status(500).json({ error: 'Failed to update job status', code: 'SERVER_ERROR' })
  }
})

router.get('/jobs/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const job = await getJobWithHistory(req.params.id)
    if (!job) { res.status(404).json({ error: 'Job not found', code: 'NOT_FOUND' }); return }

    const user = req.user!
    if (user.role === 'transporter' && job.assignedTo !== user.userId) {
      res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' }); return
    }

    const canSeePHI = ['supervisor', 'admin', 'nurse'].includes(user.role)
    const response = { ...job, patientName: canSeePHI ? job.patientName : `Patient #${job.patientId.slice(-4)}` }
    res.json({ job: response })
  } catch (error) {
    console.error('[Transport] Get job error:', error)
    res.status(500).json({ error: 'Failed to fetch job', code: 'SERVER_ERROR' })
  }
})

router.get('/nemt', requireRole('nurse', 'supervisor', 'admin'), async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json({
    providers: [
      { id: 'lyft-health', name: 'Lyft Health', available: true, avgEta: '20 minutes', services: ['standard', 'wheelchair'] },
      { id: 'modivcare', name: 'Modivcare', available: true, avgEta: '35 minutes', services: ['standard', 'wheelchair', 'stretcher', 'bariatric'] },
      { id: 'veyo', name: 'Veyo', available: false, avgEta: null, services: ['standard', 'wheelchair'] },
    ],
    note: 'STUB: Phase 4 integration pending',
  })
})

router.post('/nemt/schedule', requireRole('nurse', 'supervisor', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { patientId, destination, pickupTime, mobilityRequirements, provider } = req.body
  console.log('[NEMT STUB] Would schedule ride:', { patientId, destination, pickupTime, mobilityRequirements, provider })
  res.status(202).json({
    message: 'NEMT ride scheduling is a Phase 4 feature',
    stub: true,
    mockResult: { rideId: `stub-${Date.now()}`, provider: provider || 'Lyft Health', eta: '30 minutes', status: 'confirmed', pickupTime, destination },
  })
})
