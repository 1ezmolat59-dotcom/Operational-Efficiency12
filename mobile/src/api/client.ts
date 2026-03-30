import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import {
  Task,
  ChecklistStep,
  TransportJob,
  SupplyEntry,
  SupplyLog,
  LoginResponse,
  CleanType,
  JobStatus,
} from '../types';

const API_BASE_URL =
  (Constants.expoConfig?.extra?.apiUrl as string) ?? 'http://localhost:3001';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach Bearer token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error),
);

// Response interceptor — handle 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401
    ) {
      await AsyncStorage.multiRemove(['auth_token', 'auth_user']);
      // Navigation must be handled in AuthContext via state change
    }
    return Promise.reject(error);
  },
);

// ─── Auth API ──────────────────────────────────────────────────────────────

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/api/auth/login', {
      email,
      password,
    });
    return response.data;
  },

  refresh: async (): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/api/auth/refresh');
    return response.data;
  },
};

// ─── Tasks API ─────────────────────────────────────────────────────────────

export interface TaskQueueResponse {
  tasks: Task[];
  shiftEnd: string;
  wingName: string;
  completedToday: number;
  avgTaskTimeMinutes: number;
}

export const tasksApi = {
  getTaskQueue: async (): Promise<TaskQueueResponse> => {
    const response = await apiClient.get<TaskQueueResponse>('/api/tasks/queue');
    return response.data;
  },

  startClean: async (taskId: string): Promise<Task> => {
    const response = await apiClient.patch<Task>(
      `/api/tasks/${taskId}/start`,
    );
    return response.data;
  },

  completeRoom: async (
    taskId: string,
    payload: {
      steps: ChecklistStep[];
      photoUris: string[];
      completedAt: string;
    },
  ): Promise<Task> => {
    const response = await apiClient.patch<Task>(
      `/api/tasks/${taskId}/complete`,
      payload,
    );
    return response.data;
  },
};

// ─── Checklist API ─────────────────────────────────────────────────────────

export const checklistApi = {
  getChecklist: async (
    roomId: string,
    cleanType: CleanType,
  ): Promise<ChecklistStep[]> => {
    const response = await apiClient.get<ChecklistStep[]>(
      `/api/checklist/${roomId}`,
      { params: { cleanType } },
    );
    return response.data;
  },
};

// ─── Jobs API ──────────────────────────────────────────────────────────────

export interface JobQueueResponse {
  jobs: TransportJob[];
  activeJob: TransportJob | null;
  doneToday: number;
  avgJobTimeMinutes: number;
  available: boolean;
}

export const jobsApi = {
  getJobQueue: async (): Promise<JobQueueResponse> => {
    const response = await apiClient.get<JobQueueResponse>(
      '/api/transport/jobs/queue',
    );
    return response.data;
  },

  acceptJob: async (jobId: string): Promise<TransportJob> => {
    const response = await apiClient.patch<TransportJob>(
      `/api/transport/jobs/${jobId}/accept`,
    );
    return response.data;
  },

  declineJob: async (jobId: string): Promise<void> => {
    await apiClient.patch(`/api/transport/jobs/${jobId}/decline`);
  },

  updateJobStatus: async (
    jobId: string,
    status: JobStatus,
  ): Promise<TransportJob> => {
    const response = await apiClient.patch<TransportJob>(
      `/api/transport/jobs/${jobId}/status`,
      { status, timestamp: new Date().toISOString() },
    );
    return response.data;
  },

  getJobHistory: async (): Promise<TransportJob[]> => {
    const response = await apiClient.get<TransportJob[]>(
      '/api/transport/jobs/history',
    );
    return response.data;
  },

  setAvailability: async (available: boolean): Promise<void> => {
    await apiClient.patch('/api/transport/availability', { available });
  },

  getJobDetail: async (jobId: string): Promise<TransportJob> => {
    const response = await apiClient.get<TransportJob>(
      `/api/transport/jobs/${jobId}`,
    );
    return response.data;
  },
};

// ─── Supplies API ──────────────────────────────────────────────────────────

export const suppliesApi = {
  logSupplies: async (entry: SupplyEntry): Promise<SupplyLog> => {
    const response = await apiClient.post<SupplyLog>(
      '/api/supplies/log',
      entry,
    );
    return response.data;
  },

  flagLow: async (roomId: string): Promise<void> => {
    await apiClient.post('/api/supplies/flag-low', { roomId });
  },

  getRecentLogs: async (limit = 5): Promise<SupplyLog[]> => {
    const response = await apiClient.get<SupplyLog[]>('/api/supplies/logs', {
      params: { limit },
    });
    return response.data;
  },
};

export default apiClient;
