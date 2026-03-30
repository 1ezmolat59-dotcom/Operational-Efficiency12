import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { AuthRequest } from '../types';
import { createAlert } from '../services/alertService';

export const router = Router();

router.use(authenticate);

const logSupplySchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  sheets: z.number().int().min(0).default(0),
  pillowcases: z.number().int().min(0).default(0),
  towels: z.number().int().min(0).default(0),
  gowns: z.number().int().min(0).default(0),
});

const flagSupplySchema = z.object({
  cartId: z.string().optional(),
  location: z.string().min(1, 'location is required'),
  items: z.array(z.string()).min(1, 'At least one item must be flagged'),
  notes: z.string().optional(),
});

// POST /api/supplies/log — log linen usage
router.post(
  '/log',
  requireRole('housekeeper', 'supervisor', 'admin'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const parsed = logSupplySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: parsed.error.errors[0].message,
          code: 'VALIDATION_ERROR',
          details: parsed.error.errors,
        });
        return;
      }

      const { roomId, sheets, pillowcases, towels, gowns } = parsed.data;
      const staffId = req.user!.userId;

      // Verify room exists
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) {
        res.status(404).json({ error: 'Room not found', code: 'NOT_FOUND' });
        return;
      }

      // Define thresholds for "high usage" alerts
      const HIGH_LINEN_THRESHOLD = {
        sheets: 5,
        pillowcases: 6,
        towels: 8,
        gowns: 4,
      };

      const isHighUsage =
        sheets > HIGH_LINEN_THRESHOLD.sheets ||
        pillowcases > HIGH_LINEN_THRESHOLD.pillowcases ||
        towels > HIGH_LINEN_THRESHOLD.towels ||
        gowns > HIGH_LINEN_THRESHOLD.gowns;

      const supplyLog = await prisma.supplyLog.create({
        data: {
          staffId,
          roomId,
          sheets,
          pillowcases,
          towels,
          gowns,
          flaggedLow: false,
        },
        include: {
          staff: { select: { id: true, name: true } },
        },
      });

      // Log to activity log
      await prisma.activityLog.create({
        data: {
          type: 'supply_logged',
          message: `Supply usage logged for room ${room.roomNumber}`,
          data: { roomId, sheets, pillowcases, towels, gowns },
          staffId,
          roomId,
        },
      });

      // Alert if overage detected
      if (isHighUsage) {
        const overageItems: string[] = [];
        if (sheets > HIGH_LINEN_THRESHOLD.sheets) overageItems.push(`sheets (${sheets})`);
        if (pillowcases > HIGH_LINEN_THRESHOLD.pillowcases) overageItems.push(`pillowcases (${pillowcases})`);
        if (towels > HIGH_LINEN_THRESHOLD.towels) overageItems.push(`towels (${towels})`);
        if (gowns > HIGH_LINEN_THRESHOLD.gowns) overageItems.push(`gowns (${gowns})`);

        await createAlert({
          type: 'linen_overage',
          severity: 'warning',
          message: `High linen usage detected in room ${room.roomNumber}: ${overageItems.join(', ')}`,
          roomId,
          staffId,
        });
      }

      res.status(201).json({ supplyLog });
    } catch (error) {
      console.error('[Supplies] Log error:', error);
      res.status(500).json({ error: 'Failed to log supply usage', code: 'SERVER_ERROR' });
    }
  }
);

// POST /api/supplies/flag — flag supply cart as low
router.post(
  '/flag',
  requireRole('housekeeper', 'transporter', 'supervisor', 'admin'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const parsed = flagSupplySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: parsed.error.errors[0].message,
          code: 'VALIDATION_ERROR',
          details: parsed.error.errors,
        });
        return;
      }

      const { location, items, notes, cartId } = parsed.data;
      const staffId = req.user!.userId;

      const staff = await prisma.staff.findUnique({
        where: { id: staffId },
        select: { name: true },
      });

      const message = `Supply cart ${cartId ? `#${cartId}` : ''} at ${location} is running low on: ${items.join(', ')}. Reported by ${staff?.name}.${notes ? ` Notes: ${notes}` : ''}`;

      const alert = await createAlert({
        type: 'linen_overage',
        severity: 'warning',
        message,
        staffId,
      });

      // Log to activity log
      await prisma.activityLog.create({
        data: {
          type: 'supply_flagged',
          message: `Supply cart flagged as low at ${location}`,
          data: { location, items, cartId, notes },
          staffId,
        },
      });

      res.status(201).json({
        alert,
        message: 'Supply cart flagged successfully. Supervisor has been notified.',
      });
    } catch (error) {
      console.error('[Supplies] Flag error:', error);
      res.status(500).json({ error: 'Failed to flag supply cart', code: 'SERVER_ERROR' });
    }
  }
);

// GET /api/supplies/logs — get supply logs (supervisor/admin)
router.get(
  '/logs',
  requireRole('supervisor', 'admin'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;
      const roomId = req.query.roomId as string | undefined;

      const where: Record<string, unknown> = {};
      if (roomId) where.roomId = roomId;

      const [logs, total] = await Promise.all([
        prisma.supplyLog.findMany({
          where,
          include: {
            staff: { select: { id: true, name: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.supplyLog.count({ where }),
      ]);

      res.json({
        logs,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (error) {
      console.error('[Supplies] Get logs error:', error);
      res.status(500).json({ error: 'Failed to fetch supply logs', code: 'SERVER_ERROR' });
    }
  }
);
