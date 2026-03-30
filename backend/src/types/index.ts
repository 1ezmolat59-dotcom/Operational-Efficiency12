import { Request } from 'express'

export type StaffRole = 'housekeeper' | 'transporter' | 'supervisor' | 'admin' | 'nurse'
export type RoomStatus = 'clean' | 'dirty' | 'in_progress' | 'occupied' | 'out_of_service'
export type RoomType = 'standard' | 'icu' | 'or' | 'isolation' | 'er'
export type CleanType = 'discharge' | 'checkout' | 'routine'
export type Equipment = 'wheelchair' | 'stretcher' | 'none'
export type JobPriority = 'stat' | 'routine'
export type JobType = 'stat' | 'radiology' | 'discharge' | 'routine'
export type JobStatus = 'requested' | 'dispatched' | 'accepted' | 'in_progress' | 'complete' | 'cancelled'
export type AlertType = 'linen_overage' | 'bed_unassigned' | 'staff_no_show' | 'room_overdue' | 'supply_low'
export type AlertSeverity = 'info' | 'warning' | 'critical'
export type ShiftType = 'day' | 'evening' | 'off' | 'overtime'

export interface JwtPayload {
  userId: string
  role: StaffRole
  wingId?: string | null
  email: string
  name: string
}

export interface AuthRequest extends Request {
  user?: JwtPayload
}

export interface ChecklistStep {
  id: string
  label: string
  checked: boolean
  required: boolean
}

export interface WebSocketEvents {
  'room:status-updated': { roomId: string; status: RoomStatus; roomNumber: string; updatedAt: Date }
  'room:completed': { roomId: string; cleanRecord: object; turnaroundMinutes: number }
  'room:assigned': { roomId: string; patientName: string; nurseId: string }
  'transport:job-created': { job: object }
  'transport:job-accepted': { jobId: string; transporterId: string; transporter: object }
  'transport:job-updated': { jobId: string; status: JobStatus; timestamps: object }
  'alert:new': { alert: object }
  'alert:resolved': { alertId: string }
  'staff:status-updated': { staffId: string; status: boolean; currentTask: string | null }
  'activity:new': { type: string; message: string; data: object | null; createdAt: Date }
}

export interface KPIReport {
  avgTurnaroundTime: number
  checklistComplianceRate: number
  photoComplianceRate: number
  transportAcceptanceRate: number
  avgTransportResponseTime: number
  overtimeRate: number
  costPerTask: number
  startDate: string
  endDate: string
}

export interface LaborEntry {
  staffId: string
  staffName: string
  role: StaffRole
  totalHours: number
  regularHours: number
  overtimeHours: number
  taskCount: number
  department: string
}

export interface ForecastDay {
  date: string
  dayOfWeek: string
  predictedTasks: number
  recommendedStaff: number
}

export interface StaffingSuggestion {
  date: string
  currentStaffCount: number
  requiredStaffCount: number
  gap: number
  suggestedChanges: Array<{
    staffId: string
    staffName: string
    currentShift: ShiftType | null
    suggestedShift: ShiftType
    reason: string
  }>
}
