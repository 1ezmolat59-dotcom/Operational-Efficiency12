import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { View, Text, StyleSheet } from 'react-native';
import { tasksApi, jobsApi, suppliesApi } from '../api/client';
import {
  getQueue,
  addItem,
  removeItem,
  incrementRetries,
} from '../services/offlineQueue';
import { OfflineQueueItem, SupplyEntry } from '../types';

const MAX_RETRIES = 3;
const MAX_QUEUE_SIZE = 50;

interface OfflineContextValue {
  isOnline: boolean;
  pendingCount: number;
  addToQueue: (
    item: OfflineQueueItem,
  ) => Promise<{ success: boolean; atMaxCapacity: boolean }>;
  processQueue: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const isProcessing = useRef(false);

  const refreshCount = useCallback(async () => {
    const queue = await getQueue();
    setPendingCount(queue.length);
  }, []);

  const processQueue = useCallback(async () => {
    if (isProcessing.current || !isOnline) return;
    isProcessing.current = true;

    try {
      const queue = await getQueue();
      if (queue.length === 0) return;

      for (const item of queue) {
        if (item.retries >= MAX_RETRIES) {
          // Give up on this item after too many retries
          await removeItem(item.id);
          continue;
        }

        try {
          await executeQueueItem(item);
          await removeItem(item.id);
        } catch {
          await incrementRetries(item.id);
        }
      }
    } finally {
      isProcessing.current = false;
      await refreshCount();
    }
  }, [isOnline, refreshCount]);

  // Subscribe to network state
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);

      if (online) {
        // Process queue when connectivity restored
        void processQueue();
      }
    });

    // Get initial state
    NetInfo.fetch().then((state: NetInfoState) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
    }).catch(() => {
      setIsOnline(true); // Assume online if check fails
    });

    return () => unsubscribe();
  }, [processQueue]);

  // Refresh pending count on mount
  useEffect(() => {
    void refreshCount();
  }, [refreshCount]);

  const addToQueue = useCallback(
    async (item: OfflineQueueItem) => {
      const result = await addItem(item);
      await refreshCount();
      return result;
    },
    [refreshCount],
  );

  const value: OfflineContextValue = {
    isOnline,
    pendingCount,
    addToQueue,
    processQueue,
  };

  return (
    <OfflineContext.Provider value={value}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            Offline · {pendingCount} item{pendingCount !== 1 ? 's' : ''} pending
            sync
          </Text>
        </View>
      )}
      {children}
    </OfflineContext.Provider>
  );
}

async function executeQueueItem(item: OfflineQueueItem): Promise<void> {
  switch (item.type) {
    case 'complete_room': {
      const taskId = item.data.taskId as string;
      const steps = item.data.steps as Parameters<typeof tasksApi.completeRoom>[1]['steps'];
      const photoUris = item.data.photoUris as string[];
      const completedAt = item.data.completedAt as string;
      await tasksApi.completeRoom(taskId, { steps, photoUris, completedAt });
      break;
    }
    case 'update_job_status': {
      const jobId = item.data.jobId as string;
      const status = item.data.status as Parameters<typeof jobsApi.updateJobStatus>[1];
      await jobsApi.updateJobStatus(jobId, status);
      break;
    }
    case 'log_supplies': {
      const entry = item.data as unknown as SupplyEntry;
      await suppliesApi.logSupplies(entry);
      break;
    }
    default:
      break;
  }
}

export function useOffline(): OfflineContextValue {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  offlineBanner: {
    backgroundColor: '#dc2626',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  offlineBannerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
