import PDFDocument from 'pdfkit'
import { createObjectCsvWriter } from 'csv-writer'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import db from '../config/database'
import { getComplianceRate, getPhotoComplianceRate } from './complianceService'
import { getCostPerTask, getCostPerTransport, getOvertimeRate, getTransportResponseTime } from './financeService'
import { KPIReport, LaborEntry } from '../types'

export async function generateKPIReport(startDate: Date, endDate: Date): Promise<KPIReport> {
  const { data: cleanRecords } = await db
    .from('CleanRecord')
    .select('duration')
    .gte('completedAt', startDate.toISOString())
    .lte('completedAt', endDate.toISOString())
    .not('duration', 'is', null)

  const avgTurnaroundTime = cleanRecords && cleanRecords.length > 0
    ? cleanRecords.reduce((sum: number, r: any) => sum + (r.duration || 0), 0) / cleanRecords.length
    : 0

  const [checklistComplianceRate, photoComplianceRate, { acceptanceRate: transportAcceptanceRate, avgMinutes: avgTransportResponseTime }, { overtimeRate }, { avgCostPerTask }] = await Promise.all([
    getComplianceRate(startDate, endDate),
    getPhotoComplianceRate(startDate, endDate),
    getTransportResponseTime(startDate, endDate),
    getOvertimeRate(startDate, endDate),
    getCostPerTask(startDate, endDate),
  ])

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
  }
}

export async function generateLaborReport(startDate: Date, endDate: Date): Promise<LaborEntry[]> {
  const { data: staff } = await db.from('Staff').select('id,name,role')

  const departmentMap: Record<string, string> = {
    housekeeper: 'Environmental Services', transporter: 'Patient Transport',
    supervisor: 'Management', admin: 'Administration', nurse: 'Nursing',
  }

  const entries: LaborEntry[] = []
  for (const member of staff || []) {
    const [{ data: cleanRecs }, { data: transportJobs }, { data: schedules }] = await Promise.all([
      db.from('CleanRecord').select('duration').eq('staffId', member.id).gte('completedAt', startDate.toISOString()).lte('completedAt', endDate.toISOString()).not('duration', 'is', null),
      db.from('TransportJob').select('timestamps').eq('assignedTo', member.id).eq('status', 'complete').gte('updatedAt', startDate.toISOString()).lte('updatedAt', endDate.toISOString()),
      db.from('Schedule').select('shiftType').eq('staffId', member.id).gte('date', startDate.toISOString()).lte('date', endDate.toISOString()),
    ])

    const cleanMinutes = (cleanRecs || []).reduce((s: number, r: any) => s + (r.duration || 0), 0)
    const transportMinutes = (transportJobs || []).reduce((s: number, j: any) => {
      const ts = j.timestamps as Record<string, string>
      return s + (ts.accepted && ts.complete ? (new Date(ts.complete).getTime() - new Date(ts.accepted).getTime()) / 60000 : 30)
    }, 0)

    const totalHours = (cleanMinutes + transportMinutes) / 60
    const regularShifts = (schedules || []).filter((s: any) => s.shiftType === 'day' || s.shiftType === 'evening').length
    const overtimeShifts = (schedules || []).filter((s: any) => s.shiftType === 'overtime').length

    entries.push({
      staffId: member.id, staffName: member.name, role: member.role,
      totalHours: Math.round(totalHours * 10) / 10,
      regularHours: regularShifts * 8, overtimeHours: overtimeShifts * 4,
      taskCount: (cleanRecs || []).length + (transportJobs || []).length,
      department: departmentMap[member.role] || 'Other',
    })
  }
  return entries
}

export async function exportToPDF(data: { kpi?: KPIReport; labor?: LaborEntry[]; title?: string }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageWidth = doc.page.width - 100
    doc.fontSize(24).font('Helvetica-Bold').text(data.title || 'Hospital Operations Report', { align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(12).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
    doc.moveDown(2)

    if (data.kpi) {
      doc.fontSize(16).font('Helvetica-Bold').text('Key Performance Indicators')
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).strokeColor('#cccccc').stroke()
      doc.moveDown(0.5)
      const kpis = [
        { label: 'Date Range', value: `${data.kpi.startDate} to ${data.kpi.endDate}` },
        { label: 'Avg Turnaround Time', value: `${data.kpi.avgTurnaroundTime} minutes` },
        { label: 'Checklist Compliance', value: `${data.kpi.checklistComplianceRate}%` },
        { label: 'Photo Compliance', value: `${data.kpi.photoComplianceRate}%` },
        { label: 'Transport Acceptance', value: `${data.kpi.transportAcceptanceRate}%` },
        { label: 'Overtime Rate', value: `${data.kpi.overtimeRate}%` },
        { label: 'Cost Per Task', value: `$${data.kpi.costPerTask}` },
      ]
      for (const kpi of kpis) {
        doc.fontSize(11).font('Helvetica-Bold').text(kpi.label + ': ', { continued: true })
        doc.font('Helvetica').text(kpi.value)
        doc.moveDown(0.3)
      }
      doc.moveDown(1.5)
    }

    if (data.labor && data.labor.length > 0) {
      doc.fontSize(16).font('Helvetica-Bold').text('Labor Summary')
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).strokeColor('#cccccc').stroke()
      doc.moveDown(0.5)
      const colWidths = [140, 110, 80, 80, 80, 60]
      const headers = ['Staff Name', 'Department', 'Total Hrs', 'Regular Hrs', 'OT Hrs', 'Tasks']
      let x = 50
      doc.fontSize(10).font('Helvetica-Bold')
      headers.forEach((h, i) => { doc.text(h, x, doc.y, { width: colWidths[i] }); x += colWidths[i] })
      doc.moveDown(0.5)
      doc.fontSize(9).font('Helvetica')
      for (const entry of data.labor) {
        x = 50
        const rowY = doc.y
        const cols = [entry.staffName, entry.department, String(entry.totalHours), String(entry.regularHours), String(entry.overtimeHours), String(entry.taskCount)]
        cols.forEach((c, i) => { doc.text(c, x, rowY, { width: colWidths[i] }); x += colWidths[i] })
        doc.moveDown(0.4)
      }
    }

    doc.moveDown(2)
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).strokeColor('#cccccc').stroke()
    doc.moveDown(0.5)
    doc.fontSize(9).font('Helvetica').fillColor('#888888').text('Hospital Operations Platform - Confidential', { align: 'center' })
    doc.end()
  })
}

export async function exportToCSV(data: Record<string, unknown>[], filename: string): Promise<Buffer> {
  if (data.length === 0) return Buffer.from('No data available\n')
  const tmpFile = path.join(os.tmpdir(), `${filename}-${Date.now()}.csv`)
  const headers = Object.keys(data[0]).map((key) => ({ id: key, title: key }))
  const csvWriter = createObjectCsvWriter({ path: tmpFile, header: headers })
  await csvWriter.writeRecords(data)
  const buffer = fs.readFileSync(tmpFile)
  try { fs.unlinkSync(tmpFile) } catch { /* ignore */ }
  return buffer
}

export async function getRawKPIData(startDate: Date, endDate: Date): Promise<Record<string, unknown>[]> {
  const { data: records } = await db
    .from('CleanRecord')
    .select('*, room:Room(roomNumber,wingId), staff:Staff(name,role)')
    .gte('createdAt', startDate.toISOString())
    .lte('createdAt', endDate.toISOString())

  return (records || []).map((r: any) => ({
    id: r.id, roomNumber: r.room?.roomNumber, wingId: r.room?.wingId,
    staffName: r.staff?.name, staffRole: r.staff?.role,
    cleanType: r.cleanType, startedAt: r.startedAt,
    completedAt: r.completedAt || '', duration: r.duration || '', complianceScore: r.complianceScore || '',
    photoCount: Array.isArray(r.photos) ? r.photos.length : 0,
  }))
}
