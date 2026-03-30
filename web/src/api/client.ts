import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import {
  Room,
  CleanRecord,
  TransportJob,
  Schedule,
  ForecastDay,
  KPIData,
  Staff,
  Alert,
  ActivityEntry,
  ShiftSuggestion,
  LaborReport,
  ComplianceReport,
  CostAnalysis,
  ShiftType,
  JobStatus,
} from '@/types';

const TOKEN_KEY = 'hospital_ops_token';
const REFRESH_TOKEN_KEY = 'hospital_ops_refresh_token';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string) => void;
  reject: (reason: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token as string);
    }
  });
  failedQueue = [];
}

const apiClient: AxiosInstance = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || '') + '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const response = await axios.post('/api/auth/refresh', { refreshToken });
        const newToken: string = response.data.token;
        localStorage.setItem(TOKEN_KEY, newToken);
        processQueue(null, newToken);
        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<{ token: string; refreshToken: string; user: { id: string; name: string; email: string; role: string; wingId?: string } }>('/auth/login', { email, password }),
  refresh: (refreshToken: string) =>
    apiClient.post<{ token: string }>('/auth/refresh', { refreshToken }),
  logout: () => apiClient.post('/auth/logout'),
};

// Rooms API
export const roomsApi = {
  getRooms: (wingId?: string) =>
    apiClient.get<Room[]>('/rooms', { params: wingId ? { wingId } : {} }),
  getRoom: (roomId: string) =>
    apiClient.get<Room>(`/rooms/${roomId}`),
  startClean: (roomId: string, staffId: string, cleanType: string) =>
    apiClient.post<CleanRecord>(`/rooms/${roomId}/start-clean`, { staffId, cleanType }),
  completeRoom: (roomId: string, data: { stepsCompleted?: string[]; photos?: string[] }) =>
    apiClient.post<Room>(`/rooms/${roomId}/complete`, data),
  assignPatient: (roomId: string, patientData: { patientId: string; patientName: string }) =>
    apiClient.post<Room>(`/rooms/${roomId}/assign-patient`, patientData),
  getRoomAudit: (roomId: string) =>
    apiClient.get<CleanRecord[]>(`/rooms/${roomId}/audit`),
};

// Transport API
export const transportApi = {
  getJobs: (status?: JobStatus) =>
    apiClient.get<TransportJob[]>('/transport', { params: status ? { status } : {} }),
  createJob: (jobData: Omit<TransportJob, 'id' | 'status' | 'timestamps' | 'createdAt'>) =>
    apiClient.post<TransportJob>('/transport', jobData),
  acceptJob: (jobId: string, staffId: string) =>
    apiClient.post<TransportJob>(`/transport/${jobId}/accept`, { staffId }),
  updateJobStatus: (jobId: string, status: JobStatus) =>
    apiClient.patch<TransportJob>(`/transport/${jobId}/status`, { status }),
  getJob: (jobId: string) =>
    apiClient.get<TransportJob>(`/transport/${jobId}`),
};

// Schedule API
export const scheduleApi = {
  getSchedule: (startDate: string, endDate: string) =>
    apiClient.get<Schedule[]>('/schedule', { params: { startDate, endDate } }),
  updateShift: (staffId: string, date: string, shiftType: ShiftType) =>
    apiClient.put<Schedule>('/schedule/shift', { staffId, date, shiftType }),
  getForecast: () =>
    apiClient.get<ForecastDay[]>('/schedule/forecast'),
  getSuggestions: () =>
    apiClient.get<ShiftSuggestion[]>('/schedule/suggestions'),
};

// Reports API
export const reportsApi = {
  getKPI: (startDate: string, endDate: string) =>
    apiClient.get<KPIData>('/reports/kpi', { params: { startDate, endDate } }),
  getLabor: (startDate: string, endDate: string) =>
    apiClient.get<LaborReport[]>('/reports/labor', { params: { startDate, endDate } }),
  getCompliance: (startDate: string, endDate: string) =>
    apiClient.get<ComplianceReport[]>('/reports/compliance', { params: { startDate, endDate } }),
  getCostPerTask: (startDate: string, endDate: string) =>
    apiClient.get<CostAnalysis[]>('/reports/cost-per-task', { params: { startDate, endDate } }),
  exportPDF: (type: string, startDate: string, endDate: string) =>
    apiClient.get('/reports/export/pdf', {
      params: { type, startDate, endDate },
      responseType: 'blob',
    }),
  exportCSV: (type: string, startDate: string, endDate: string) =>
    apiClient.get('/reports/export/csv', {
      params: { type, startDate, endDate },
      responseType: 'blob',
    }),
};

// Supplies API
export const suppliesApi = {
  logSupplies: (data: { roomId: string; items: Array<{ name: string; quantity: number }> }) =>
    apiClient.post('/supplies/log', data),
  flagLow: (itemId: string, quantity: number) =>
    apiClient.post('/supplies/flag-low', { itemId, quantity }),
};

// Staff API
export const staffApi = {
  getStaff: (role?: string) =>
    apiClient.get<Staff[]>('/staff', { params: role ? { role } : {} }),
  updateAvailability: (staffId: string, available: boolean) =>
    apiClient.patch<Staff>(`/staff/${staffId}/availability`, { available }),
};

// Alerts API
export const alertsApi = {
  getAlerts: (resolved?: boolean) =>
    apiClient.get<Alert[]>('/alerts', { params: resolved !== undefined ? { resolved } : {} }),
  resolveAlert: (alertId: string) =>
    apiClient.post<Alert>(`/alerts/${alertId}/resolve`),
};

// Activity API
export const activityApi = {
  getActivity: (limit?: number) =>
    apiClient.get<ActivityEntry[]>('/activity', { params: limit ? { limit } : {} }),
};

export default apiClient;
