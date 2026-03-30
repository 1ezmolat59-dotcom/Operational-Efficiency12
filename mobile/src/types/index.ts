export type StaffRole = 'housekeeper' | 'transporter' | 'supervisor' | 'admin' | 'nurse';
export type RoomStatus = 'dirty' | 'in_progress' | 'clean_ready' | 'occupied' | 'offline';
export type CleanType = 'discharge' | 'checkout' | 'routine';
export type JobStatus = 'requested' | 'accepted' | 'en_route' | 'arrived' | 'in_progress' | 'complete' | 'cancelled';
export type JobType = 'stat' | 'radiology' | 'discharge' | 'routine';
export type TaskPriority = 'urgent' | 'in_progress' | 'up_next';

export interface User {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  wingId?: string;
  wingName?: string;
  shiftEnd?: string;
}

export interface Task {
  id: string;
  roomId: string;
  roomNumber: string;
  cleanType: CleanType;
  priority: TaskPriority;
  status: 'pending' | 'in_progress' | 'complete';
  requestedBy?: string;
  elapsedMinutes: number;
  estimatedMinutes: number;
  patientName?: string;
  wingName?: string;
  startedAt?: string;
  currentStep?: number;
  totalSteps?: number;
}

export interface ChecklistStep {
  id: string;
  zone: string;
  description: string;
  checked: boolean;
  isHAIRisk: boolean;
  order: number;
}

export interface ChecklistZone {
  name: string;
  steps: ChecklistStep[];
}

export interface TransportJob {
  id: string;
  patientId: string;
  patientName: string;
  fromLocation: string;
  toLocation: string;
  equipment: 'wheelchair' | 'stretcher' | 'none';
  priority: 'stat' | 'routine';
  jobType: JobType;
  status: JobStatus;
  timestamps: Record<string, string>;
  requesterName?: string;
  createdAt: string;
}

export interface SupplyEntry {
  roomId: string;
  sheets: number;
  pillowcases: number;
  towels: number;
  gowns: number;
  flaggedLow: boolean;
}

export interface SupplyLog extends SupplyEntry {
  id: string;
  loggedAt: string;
  loggedBy: string;
}

export interface OfflineQueueItem {
  id: string;
  type: 'complete_room' | 'update_job_status' | 'log_supplies';
  data: Record<string, unknown>;
  timestamp: string;
  retries: number;
}

export interface ShiftStats {
  tasksCompleted: number;
  tasksRemaining: number;
  avgTaskTimeMinutes: number;
  jobsDone?: number;
  avgJobTimeMinutes?: number;
}

export interface LoginResponse {
  token: string;
  user: User;
}
