import { useEffect, useCallback, useState } from 'react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { BedDouble, Clock, Truck, CheckSquare } from 'lucide-react';
import { roomsApi, staffApi, alertsApi, activityApi, transportApi } from '@/api/client';
import { Room, Staff, Alert, ActivityEntry, TransportJob } from '@/types';
import { useWebSocket, WS_EVENTS } from '@/hooks/useWebSocket';
import { useAuth } from '@/hooks/useAuth';
import { MetricTile } from '@/components/common/MetricTile';
import { RoomGrid } from '@/components/supervisor/RoomGrid';
import { EVSStaffPanel } from '@/components/supervisor/EVSStaffPanel';
import { TransportStaffPanel } from '@/components/supervisor/TransportStaffPanel';
import { AlertsFeed } from '@/components/supervisor/AlertsFeed';
import { ActivityFeed } from '@/components/supervisor/ActivityFeed';

function calcAvgTurnaround(rooms: Room[]): number {
  const withCleans = rooms.filter(
    (r) => r.lastClean?.completedAt && r.lastClean?.startedAt
  );
  if (!withCleans.length) return 0;
  const total = withCleans.reduce((sum, r) => {
    const start = new Date(r.lastClean!.startedAt).getTime();
    const end = new Date(r.lastClean!.completedAt!).getTime();
    return sum + (end - start) / 60000;
  }, 0);
  return Math.round(total / withCleans.length);
}

function calcCompliance(rooms: Room[]): number {
  const today = new Date().toDateString();
  const todayCleans = rooms.filter((r) => {
    if (!r.lastClean?.completedAt) return false;
    return new Date(r.lastClean.completedAt).toDateString() === today;
  });
  if (!todayCleans.length) return 0;
  const total = todayCleans.reduce(
    (sum, r) => sum + (r.lastClean?.complianceScore ?? 0),
    0
  );
  return Math.round(total / todayCleans.length);
}

export default function SupervisorDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { subscribe, connected } = useWebSocket();
  const [activityLocal, setActivityLocal] = useState<ActivityEntry[]>([]);
  const [alertsLocal, setAlertsLocal] = useState<Alert[]>([]);

  // ── Data fetching ──
  const { data: rooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomsApi.getRooms().then((r) => r.data),
    refetchInterval: 60000,
  });

  const { data: evsStaff = [], isLoading: evsLoading } = useQuery({
    queryKey: ['staff', 'housekeeper'],
    queryFn: () => staffApi.getStaff('housekeeper').then((r) => r.data),
    refetchInterval: 60000,
  });

  const { data: transportStaff = [], isLoading: transportLoading } = useQuery({
    queryKey: ['staff', 'transporter'],
    queryFn: () => staffApi.getStaff('transporter').then((r) => r.data),
    refetchInterval: 60000,
  });

  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => alertsApi.getAlerts(false).then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: () => activityApi.getActivity(50).then((r) => r.data),
  });

  const { data: transportJobs = [] } = useQuery({
    queryKey: ['transport', 'requested'],
    queryFn: () => transportApi.getJobs('requested').then((r) => r.data),
    refetchInterval: 30000,
  });

  // Sync fetched data to local state for real-time merging
  useEffect(() => {
    setAlertsLocal(alerts);
  }, [alerts]);

  useEffect(() => {
    setActivityLocal(activities);
  }, [activities]);

  // ── Mutations ──
  const resolveAlertMutation = useMutation({
    mutationFn: (alertId: string) => alertsApi.resolveAlert(alertId),
    onMutate: async (alertId) => {
      setAlertsLocal((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, resolved: true } : a))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const toggleAvailabilityMutation = useMutation({
    mutationFn: ({ staffId, available }: { staffId: string; available: boolean }) =>
      staffApi.updateAvailability(staffId, available),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });

  // ── WebSocket event handlers ──
  const handleRoomUpdate = useCallback(
    (data: Room) => {
      queryClient.setQueryData<Room[]>(['rooms'], (old) => {
        if (!old) return [data];
        return old.map((r) => (r.id === data.id ? data : r));
      });
    },
    [queryClient]
  );

  const handleNewAlert = useCallback((data: Alert) => {
    setAlertsLocal((prev) => [data, ...prev]);
    // Browser notification
    if (Notification.permission === 'granted') {
      new Notification(`Alert: ${data.severity.toUpperCase()}`, {
        body: data.message,
        tag: data.id,
      });
    }
  }, []);

  const handleNewActivity = useCallback((data: ActivityEntry) => {
    setActivityLocal((prev) => [data, ...prev].slice(0, 50));
  }, []);

  const handleTransportUpdate = useCallback(
    (data: TransportJob) => {
      queryClient.setQueryData<TransportJob[]>(['transport', 'requested'], (old) => {
        if (!old) return [data];
        const exists = old.find((j) => j.id === data.id);
        if (exists) {
          return old.map((j) => (j.id === data.id ? data : j));
        }
        return [data, ...old];
      });
    },
    [queryClient]
  );

  const handleStaffUpdate = useCallback(
    (data: Staff) => {
      const key = data.role === 'housekeeper' ? 'housekeeper' : 'transporter';
      queryClient.setQueryData<Staff[]>(['staff', key], (old) => {
        if (!old) return [data];
        return old.map((s) => (s.id === data.id ? data : s));
      });
    },
    [queryClient]
  );

  // Subscribe to socket events
  useEffect(() => {
    const unsubs = [
      subscribe<Room>(WS_EVENTS.ROOM_STATUS_UPDATED, handleRoomUpdate),
      subscribe<Alert>(WS_EVENTS.ALERT_NEW, handleNewAlert),
      subscribe<ActivityEntry>(WS_EVENTS.ACTIVITY_NEW, handleNewActivity),
      subscribe<TransportJob>(WS_EVENTS.TRANSPORT_JOB_UPDATED, handleTransportUpdate),
      subscribe<Staff>(WS_EVENTS.STAFF_STATUS_UPDATED, handleStaffUpdate),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [subscribe, handleRoomUpdate, handleNewAlert, handleNewActivity, handleTransportUpdate, handleStaffUpdate]);

  // Request notification permission on mount
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ── Derived metrics ──
  const dirtyBeds = rooms.filter((r) => r.status === 'dirty').length;
  const avgTurnaround = calcAvgTurnaround(rooms);
  const pendingJobs = transportJobs.filter((j) => j.status === 'requested').length;
  const compliance = calcCompliance(rooms);

  const isSupervisor = user?.role === 'supervisor' || user?.role === 'admin';

  function handleReassign(staffId: string, roomId: string) {
    // Fire-and-forget: reassign via startClean API
    roomsApi.startClean(roomId, staffId, 'routine').then(() => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Live Operations Dashboard</h1>
          <p className="text-sm text-gray-400">
            Real-time hospital operations overview
            {connected && (
              <span className="ml-2 inline-flex items-center gap-1 text-teal-600">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
                Live
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Metric strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricTile
          label="Dirty Beds"
          value={dirtyBeds}
          icon={BedDouble}
          color={dirtyBeds > 5 ? 'red' : 'default'}
          isLoading={roomsLoading}
        />
        <MetricTile
          label="Avg Turnaround"
          value={avgTurnaround}
          unit="min"
          icon={Clock}
          color={avgTurnaround > 30 ? 'amber' : 'teal'}
          isLoading={roomsLoading}
        />
        <MetricTile
          label="Pending Transport"
          value={pendingJobs}
          icon={Truck}
          color={pendingJobs > 3 ? 'amber' : 'default'}
          isLoading={false}
        />
        <MetricTile
          label="Compliance Rate"
          value={compliance}
          unit="%"
          icon={CheckSquare}
          color={compliance >= 90 ? 'teal' : compliance >= 70 ? 'amber' : 'red'}
          isLoading={roomsLoading}
        />
      </div>

      {/* Main content: two columns */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left column: staff panels */}
        <div className="space-y-5 lg:col-span-1">
          <EVSStaffPanel
            staff={evsStaff}
            rooms={rooms}
            onReassign={handleReassign}
            isLoading={evsLoading}
            isSupervisor={isSupervisor}
          />
          <TransportStaffPanel
            staff={transportStaff}
            onToggleAvailability={(id, available) =>
              toggleAvailabilityMutation.mutate({ staffId: id, available })
            }
            isLoading={transportLoading}
          />
        </div>

        {/* Right column: room grid + alerts + activity */}
        <div className="space-y-5 lg:col-span-2">
          {/* Room grid */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Room Status</h2>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-red-200 border border-red-300" />
                  Dirty
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-blue-200 border border-blue-300" />
                  In Progress
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-teal-200 border border-teal-300" />
                  Clean & Ready
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-gray-200 border border-gray-300" />
                  Occupied
                </span>
              </div>
            </div>
            <RoomGrid
              rooms={rooms}
              isSupervisor={isSupervisor}
              isLoading={roomsLoading}
            />
          </div>

          {/* Alerts + Activity side by side */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <AlertsFeed
              alerts={alertsLocal}
              onResolve={(id) => resolveAlertMutation.mutate(id)}
              isLoading={alertsLoading}
            />
            <ActivityFeed
              activities={activityLocal}
              isLoading={activitiesLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
