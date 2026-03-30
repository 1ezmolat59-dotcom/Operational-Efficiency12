import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { AuthRequest } from '../types';
import {
  generateKPIReport,
  generateLaborReport,
  exportToPDF,
  exportToCSV,
  getRawKPIData,
} from '../services/reportService';
import { getDetailedComplianceReport } from '../services/complianceService';
import {
  getCostPerTask,
  getCostPerTransport,
  getOvertimeRate,
} from '../services/financeService';

export const router = Router();

router.use(authenticate);

function parseDateRange(req: AuthRequest): { startDate: Date; endDate: Date } | null {
  const { startDate: startParam, endDate: endParam } = req.query;

  const startDate = startParam ? new Date(startParam as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = endParam ? new Date(endParam as string) : new Date();

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return null;
  }

  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
}

// GET /api/reports/kpi
router.get(
  '/kpi',
  requireRole('admin', 'supervisor'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const dates = parseDateRange(req);
      if (!dates) {
        res.status(400).json({ error: 'Invalid date range', code: 'VALIDATION_ERROR' });
        return;
      }

      const kpi = await generateKPIReport(dates.startDate, dates.endDate);
      res.json({ kpi });
    } catch (error) {
      console.error('[Reports] KPI error:', error);
      res.status(500).json({ error: 'Failed to generate KPI report', code: 'SERVER_ERROR' });
    }
  }
);

// GET /api/reports/labor
router.get(
  '/labor',
  requireRole('admin'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const dates = parseDateRange(req);
      if (!dates) {
        res.status(400).json({ error: 'Invalid date range', code: 'VALIDATION_ERROR' });
        return;
      }

      const labor = await generateLaborReport(dates.startDate, dates.endDate);

      // Group by department
      const byDepartment = labor.reduce(
        (acc, entry) => {
          if (!acc[entry.department]) {
            acc[entry.department] = {
              department: entry.department,
              staffCount: 0,
              totalHours: 0,
              overtimeHours: 0,
              taskCount: 0,
              staff: [],
            };
          }
          acc[entry.department].staffCount++;
          acc[entry.department].totalHours += entry.totalHours;
          acc[entry.department].overtimeHours += entry.overtimeHours;
          acc[entry.department].taskCount += entry.taskCount;
          acc[entry.department].staff.push(entry);
          return acc;
        },
        {} as Record<
          string,
          {
            department: string;
            staffCount: number;
            totalHours: number;
            overtimeHours: number;
            taskCount: number;
            staff: typeof labor;
          }
        >
      );

      res.json({
        labor,
        byDepartment: Object.values(byDepartment),
        period: {
          startDate: dates.startDate.toISOString().split('T')[0],
          endDate: dates.endDate.toISOString().split('T')[0],
        },
      });
    } catch (error) {
      console.error('[Reports] Labor error:', error);
      res.status(500).json({ error: 'Failed to generate labor report', code: 'SERVER_ERROR' });
    }
  }
);

// GET /api/reports/compliance
router.get(
  '/compliance',
  requireRole('admin', 'supervisor'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const dates = parseDateRange(req);
      if (!dates) {
        res.status(400).json({ error: 'Invalid date range', code: 'VALIDATION_ERROR' });
        return;
      }

      const compliance = await getDetailedComplianceReport(dates.startDate, dates.endDate);

      res.json({
        compliance,
        period: {
          startDate: dates.startDate.toISOString().split('T')[0],
          endDate: dates.endDate.toISOString().split('T')[0],
        },
      });
    } catch (error) {
      console.error('[Reports] Compliance error:', error);
      res.status(500).json({ error: 'Failed to generate compliance report', code: 'SERVER_ERROR' });
    }
  }
);

// GET /api/reports/cost-per-task
router.get(
  '/cost-per-task',
  requireRole('admin'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const dates = parseDateRange(req);
      if (!dates) {
        res.status(400).json({ error: 'Invalid date range', code: 'VALIDATION_ERROR' });
        return;
      }

      const [evsCost, transportCost, overtimeData] = await Promise.all([
        getCostPerTask(dates.startDate, dates.endDate),
        getCostPerTransport(dates.startDate, dates.endDate),
        getOvertimeRate(dates.startDate, dates.endDate),
      ]);

      res.json({
        evs: evsCost,
        transport: transportCost,
        overtime: overtimeData,
        period: {
          startDate: dates.startDate.toISOString().split('T')[0],
          endDate: dates.endDate.toISOString().split('T')[0],
        },
      });
    } catch (error) {
      console.error('[Reports] Cost per task error:', error);
      res.status(500).json({ error: 'Failed to generate cost report', code: 'SERVER_ERROR' });
    }
  }
);

// GET /api/reports/export/pdf
router.get(
  '/export/pdf',
  requireRole('admin'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const dates = parseDateRange(req);
      if (!dates) {
        res.status(400).json({ error: 'Invalid date range', code: 'VALIDATION_ERROR' });
        return;
      }

      const [kpi, labor] = await Promise.all([
        generateKPIReport(dates.startDate, dates.endDate),
        generateLaborReport(dates.startDate, dates.endDate),
      ]);

      const pdfBuffer = await exportToPDF({
        kpi,
        labor,
        title: `Hospital Operations Report: ${dates.startDate.toISOString().split('T')[0]} to ${dates.endDate.toISOString().split('T')[0]}`,
      });

      const filename = `hospital-ops-report-${dates.startDate.toISOString().split('T')[0]}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('[Reports] PDF export error:', error);
      res.status(500).json({ error: 'Failed to generate PDF report', code: 'SERVER_ERROR' });
    }
  }
);

// GET /api/reports/export/csv
router.get(
  '/export/csv',
  requireRole('admin'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const dates = parseDateRange(req);
      if (!dates) {
        res.status(400).json({ error: 'Invalid date range', code: 'VALIDATION_ERROR' });
        return;
      }

      const type = (req.query.type as string) || 'kpi';
      let data: Record<string, unknown>[];
      let filename: string;

      if (type === 'labor') {
        const labor = await generateLaborReport(dates.startDate, dates.endDate);
        data = labor.map((l) => ({
          staffId: l.staffId,
          staffName: l.staffName,
          role: l.role,
          department: l.department,
          totalHours: l.totalHours,
          regularHours: l.regularHours,
          overtimeHours: l.overtimeHours,
          taskCount: l.taskCount,
        }));
        filename = 'labor-report';
      } else {
        data = await getRawKPIData(dates.startDate, dates.endDate);
        filename = 'operations-data';
      }

      const csvBuffer = await exportToCSV(data, filename);
      const csvFilename = `${filename}-${dates.startDate.toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${csvFilename}"`);
      res.setHeader('Content-Length', csvBuffer.length);
      res.send(csvBuffer);
    } catch (error) {
      console.error('[Reports] CSV export error:', error);
      res.status(500).json({ error: 'Failed to generate CSV export', code: 'SERVER_ERROR' });
    }
  }
);
