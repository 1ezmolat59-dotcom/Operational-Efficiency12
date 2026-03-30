export type StaffRole = 'housekeeper' | 'transporter' | 'supervisor' | 'admin' | 'nurse';
export type RoomStatus = 'dirty' | 'in_progress' | 'clean_ready' | 'occupied' | 'offline';
export type RoomType = 'single' | 'double' | 'isolation';
export type CleanType = 'discharge' | 'checkout' | 'routine';
export type JobStatus = 'requested' | 'accepted' | 'in_progress' | 'complete' | 'cancelled';
export type JobType = 'stat' | 'radiology' | 'discharge' | 'routine';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type ShiftType = 'day' | 'evening' | 'off' | 'overtime';

export interface User {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  wingId?: string;
}

export interface Room {
  id: string;
  wingId: string;
  roomNumber: string;
  roomType: RoomType;
  status: RoomStatus;
  currentPatientId?: string;
  patientName?: string;
  mobilityEquipmentRequired: boolean;
  lastClean?: CleanRecord;
  updatedAt: string;
}

export interface CleanRecord {
  id: string;
  roomId: string;
  staffId: string;
  staff?: Staff;
  cleanType: CleanType;
  startedAt: string;
  completedAt?: string;
  stepsCompleted?: ChecklistStep[];
  photos?: string[];
  complianceScore?: number;
  duration?: number;
}

export interface ChecklistStep {
  id: string;
  description: string;
  checked: boolean;
  isHAIRisk: boolean;
  zone: string;
}

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  wingId?: string;
  currentLocation?: string;
  availabilityStatus: boolean;
  shiftStart?: string;
  shiftEnd?: string;
  currentTask?: string;
  currentJob?: string;
}

export interface TransportJob {
  id: string;
  patientId: string;
  patientName: string;
  requestedBy: string;
  requesterName?: string;
  assignedTo?: string;
  assignee?: Staff;
  fromLocation: string;
  toLocation: string;
  equipment: 'wheelchair' | 'stretcher' | 'none';
  priority: 'stat' | 'routine';
  jobType: JobType;
  status: JobStatus;
  timestamps: Record<string, string>;
  createdAt: string;
}

export interface Alert {
  id: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  roomId?: string;
  staffId?: string;
  jobId?: string;
  resolved: boolean;
  createdAt: string;
}

export interface ActivityEntry {
  type: string;
  message: string;
  data?: Record<string, unknown>;
  createdAt: string;
}

export interface Schedule {
  id: string;
  staffId: string;
  staff: Staff;
  date: string;
  shiftType: ShiftType;
}

export interface ForecastDay {
  date: string;
  dayOfWeek: string;
  predictedDemand: number;
  staffedCapacity: number;
  isBelowThreshold: boolean;
}

export interface KPIData {
  costPerEVSTask: number;
  costPerTransport: number;
  avgBedTurnaround: number;
  overtimeRate: number;
  checklistCompliance: number;
  photoCompliance: number;
  onTimeTransport: number;
  targets: {
    costPerEVSTask: number;
    costPerTransport: number;
    avgBedTurnaround: number;
    overtimeRate: number;
    checklistCompliance: number;
    photoCompliance: number;
    onTimeTransport: number;
  };
}

export interface ShiftSuggestion {
  staffId: string;
  staffName: string;
  date: string;
  dayOfWeek: string;
  suggestedShift: ShiftType;
  reason: string;
}

export interface LaborReport {
  staffId: string;
  staffName: string;
  role: StaffRole;
  hoursWorked: number;
  tasksCompleted: number;
  otHours: number;
  date: string;
}

export interface ComplianceReport {
  roomId: string;
  roomNumber: string;
  compliancePercent: number;
  staffName: string;
  date: string;
  cleanType: CleanType;
}

export interface CostAnalysis {
  date: string;
  costPerEVSTask: number;
  costPerTransport: number;
  totalCost: number;
}
