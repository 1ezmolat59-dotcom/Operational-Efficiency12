import PDFDocument from 'pdfkit';
import { createObjectCsvWriter } from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import prisma from '../config/database';
import { getComplianceRate, getPhotoComplianceRate } from './complianceService';
import {
  getCostPerTask,
  getCostPerTransport,
  getOvertimeRate,
  getTransportResponseTime,
} from './financeService';
import { KPIReport, LaborEntry } from '../types';

export async function generateKPIReport(
  startDate: Date,
  endDate: Date
): Promise<KPIReport> {
  // 1. Avg turnaround time (minutes from dirty to clean_ready)
  const cleanRecords = await prisma.cleanRecord.findMany({
    where: {
      completedAt: { gte: startDate, lte: endDate },
      duration: { not: null },
    },
    select: { duration: true },
  });
  const avgTurnaroundTime =
    cleanRecords.length > 0
      ? cleanRecords.reduce((sum, r) => sum + (r.duration || 0), 0) / cleanRecords.length
      : 0;

  // 2. Checklist compliance rate
  const checklistComplianceRate = await getComplianceRate(startDate, endDate);

  // 3. Photo compliance rate
  const photoComplianceRate = await getPhotoComplianceRate(startDate, endDate);

  // 4 & 5. Transport acceptance rate and avg response time
  const { acceptanceRate: transportAcceptanceRate, avgMinutes: avgTransportResponseTime } =
    await getTransportResponseTime(startDate, endDate);

  // 6. Overtime rate
  const { overtimeRate } = await getOvertimeRate(startDate, endDate);

  // 7. Cost per task
  const { avgCostPerTask } = await getCostPerTask(startDate, endDate);

  return {
    avgTurnaroundTime: Math.round(avgTurnaroundTime * 10) / 10,
    checklistComplianceRate: Math.round(checklistComplianceRate * 10) / 10,
    photoComplianceRate: Math.round(photoComplianceRate * 10) / 10,
    transportAcceptanceRate: Math.round(transportAcceptanceRate * 10) / 10,
    avgTransportResponseTime: Math.round(avgTransportResponseTime * 10) / 10,
    overtimeRate: Math.round(overtimeRate * 10) / 10,
    costPerTask: Math.round(avgCostPerTask * 100) / 100,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

export async function generateLaborReport(
  startDate: Date,
  endDate: Date
): Promise<LaborEntry[]> {
  const staff = await prisma.staff.findMany({
    include: {
      cleanRecords: {
        where: {
          completedAt: { gte: startDate, lte: endDate },
          duration: { not: null },
        },
        select: { duration: true },
      },
      assignedJobs: {
        where: {
          status: 'complete',
          updatedAt: { gte: startDate, lte: endDate },
        },
        select: { timestamps: true },
      },
      schedules: {
        where: {
          date: { gte: startDate, lte: endDate },
        },
        select: { shiftType: true },
      },
    },
  });

  const laborEntries: LaborEntry[] = staff.map((member) => {
    const cleanMinutes = member.cleanRecords.reduce(
      (sum, r) => sum + (r.duration || 0),
      0
    );

    // Calculate transport hours from timestamps
    const transportMinutes = member.assignedJobs.reduce((sum, job) => {
      const ts = job.timestamps as Record<string, string>;
      if (ts.accepted && ts.complete) {
        const start = new Date(ts.accepted).getTime();
        const end = new Date(ts.complete).getTime();
        return sum + (end - start) / (1000 * 60);
      }
      return sum + 30; // Default 30 min per job
    }, 0);

    const totalMinutes = cleanMinutes + transportMinutes;
    const totalHours = totalMinutes / 60;

    // Calculate scheduled vs overtime
    const overtimeShifts = member.schedules.filter(
      (s) => s.shiftType === 'overtime'
    ).length;
    const regularShifts = member.schedules.filter(
      (s) => s.shiftType === 'day' || s.shiftType === 'evening'
    ).length;

    const regularHours = regularShifts * 8;
    const overtimeHours = overtimeShifts * 4;

    const departmentMap: Record<string, string> = {
      housekeeper: 'Environmental Services',
      transporter: 'Patient Transport',
      supervisor: 'Management',
      admin: 'Administration',
      nurse: 'Nursing',
    };

    return {
      staffId: member.id,
      staffName: member.name,
      role: member.role,
      totalHours: Math.round(totalHours * 10) / 10,
      regularHours,
      overtimeHours,
      taskCount: member.cleanRecords.length + member.assignedJobs.length,
      department: departmentMap[member.role] || 'Other',
    };
  });

  return laborEntries;
}

export async function exportToPDF(data: {
  kpi?: KPIReport;
  labor?: LaborEntry[];
  title?: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 100; // margins

    // Header
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(data.title || 'Hospital Operations Report', { align: 'center' });

    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .font('Helvetica')
      .text(`Generated: ${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`, { align: 'center' });

    doc.moveDown(2);

    // KPI Section
    if (data.kpi) {
      doc.fontSize(16).font('Helvetica-Bold').text('Key Performance Indicators');
      doc
        .moveTo(50, doc.y)
        .lineTo(50 + pageWidth, doc.y)
        .strokeColor('#cccccc')
        .stroke();
      doc.moveDown(0.5);

      const kpis = [
        { label: 'Date Range', value: `${data.kpi.startDate} to ${data.kpi.endDate}` },
        { label: 'Avg Turnaround Time', value: `${data.kpi.avgTurnaroundTime} minutes` },
        { label: 'Checklist Compliance Rate', value: `${data.kpi.checklistComplianceRate}%` },
        { label: 'Photo Compliance Rate', value: `${data.kpi.photoComplianceRate}%` },
        { label: 'Transport Acceptance Rate', value: `${data.kpi.transportAcceptanceRate}%` },
        { label: 'Avg Transport Response Time', value: `${data.kpi.avgTransportResponseTime} minutes` },
        { label: 'Overtime Rate', value: `${data.kpi.overtimeRate}%` },
        { label: 'Cost Per Task', value: `$${data.kpi.costPerTask}` },
      ];

      for (const kpi of kpis) {
        doc.fontSize(11).font('Helvetica-Bold').text(kpi.label + ': ', { continued: true });
        doc.font('Helvetica').text(kpi.value);
        doc.moveDown(0.3);
      }

      doc.moveDown(1.5);
    }

    // Labor Summary Section
    if (data.labor && data.labor.length > 0) {
      doc.fontSize(16).font('Helvetica-Bold').text('Labor Summary');
      doc
        .moveTo(50, doc.y)
        .lineTo(50 + pageWidth, doc.y)
        .strokeColor('#cccccc')
        .stroke();
      doc.moveDown(0.5);

      // Table headers
      const colWidths = [140, 110, 80, 80, 80, 60];
      const headers = ['Staff Name', 'Department', 'Total Hrs', 'Regular Hrs', 'OT Hrs', 'Tasks'];
      let x = 50;

      doc.fontSize(10).font('Helvetica-Bold');
      headers.forEach((header, i) => {
        doc.text(header, x, doc.y, { width: colWidths[i] });
        x += colWidths[i];
      });
      doc.moveDown(0.5);

      doc
        .moveTo(50, doc.y)
        .lineTo(50 + pageWidth, doc.y)
        .strokeColor('#cccccc')
        .stroke();
      doc.moveDown(0.3);

      // Table rows
      doc.fontSize(9).font('Helvetica');
      for (const entry of data.labor) {
        x = 50;
        const rowY = doc.y;
        const cols = [
          entry.staffName,
          entry.department,
          entry.totalHours.toString(),
          entry.regularHours.toString(),
          entry.overtimeHours.toString(),
          entry.taskCount.toString(),
        ];
        cols.forEach((col, i) => {
          doc.text(col, x, rowY, { width: colWidths[i] });
          x += colWidths[i];
        });
        doc.moveDown(0.4);
      }
    }

    // Footer
    doc.moveDown(2);
    doc
      .moveTo(50, doc.y)
      .lineTo(50 + pageWidth, doc.y)
      .strokeColor('#cccccc')
      .stroke();
    doc.moveDown(0.5);
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#888888')
      .text('Hospital Operations Platform - Confidential Report', { align: 'center' });

    doc.end();
  });
}

export async function exportToCSV(
  data: Record<string, unknown>[],
  filename: string
): Promise<Buffer> {
  if (data.length === 0) {
    return Buffer.from('No data available\n');
  }

  // Write to temp file then read back
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `${filename}-${Date.now()}.csv`);

  const headers = Object.keys(data[0]).map((key) => ({ id: key, title: key }));

  const csvWriter = createObjectCsvWriter({
    path: tmpFile,
    header: headers,
  });

  await csvWriter.writeRecords(data);

  const buffer = fs.readFileSync(tmpFile);

  // Clean up temp file
  try {
    fs.unlinkSync(tmpFile);
  } catch {
    // Ignore cleanup errors
  }

  return buffer;
}

export async function getRawKPIData(
  startDate: Date,
  endDate: Date
): Promise<Record<string, unknown>[]> {
  const records = await prisma.cleanRecord.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
    include: {
      room: { select: { roomNumber: true, wingId: true } },
      staff: { select: { name: true, role: true } },
    },
  });

  return records.map((r) => ({
    id: r.id,
    roomNumber: r.room.roomNumber,
    wingId: r.room.wingId,
    staffName: r.staff.name,
    staffRole: r.staff.role,
    cleanType: r.cleanType,
    startedAt: r.startedAt.toISOString(),
    completedAt: r.completedAt?.toISOString() || '',
    duration: r.duration || '',
    complianceScore: r.complianceScore || '',
    photoCount: Array.isArray(r.photos) ? (r.photos as unknown[]).length : 0,
  }));
}
