import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { tasksApi } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Task } from '@/types';
import TaskCard from '@/components/TaskCard';
import StatStrip from '@/components/StatStrip';
import Badge from '@/components/Badge';

interface SectionData {
  title: string;
  color: string;
  data: Task[];
}

export default function HousekeeperTaskQueue() {
  const { user } = useAuth();
  const router = useRouter();
  const { socket } = useWebSocket();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [shiftEnd, setShiftEnd] = useState<string>('');
  const [wingName, setWingName] = useState<string>('');
  const [completedToday, setCompletedToday] = useState(0);
  const [avgTime, setAvgTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const data = await tasksApi.getTaskQueue();
      setTasks(data.tasks);
      setShiftEnd(data.shiftEnd);
      setWingName(data.wingName);
      setCompletedToday(data.completedToday);
      setAvgTime(data.avgTaskTimeMinutes);
    } catch {
      setError('Unable to load task queue. Check your connection and try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  // Real-time updates via WebSocket
  useEffect(() => {
    if (!socket) return;

    const handleTaskUpdate = (updatedTask: Task) => {
      setTasks((prev) => {
        const index = prev.findIndex((t) => t.id === updatedTask.id);
        if (index === -1) {
          return [...prev, updatedTask];
        }
        const next = [...prev];
        next[index] = updatedTask;
        return next;
      });
    };

    socket.on('task:updated', handleTaskUpdate);
    socket.on('task:new', (task: Task) => {
      setTasks((prev) => [task, ...prev]);
    });

    return () => {
      socket.off('task:updated', handleTaskUpdate);
      socket.off('task:new');
    };
  }, [socket]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void fetchTasks(true);
  }, [fetchTasks]);

  const handleStart = useCallback(
    (task: Task) => {
      router.push({
        pathname: '/(housekeeper)/checklist',
        params: {
          taskId: task.id,
          roomId: task.roomId,
          roomNumber: task.roomNumber,
          cleanType: task.cleanType,
          patientName: task.patientName ?? '',
        },
      });
    },
    [router],
  );

  const urgentTasks = tasks.filter((t) => t.priority === 'urgent' && t.status !== 'complete');
  const inProgressTasks = tasks.filter((t) => t.priority === 'in_progress' || t.status === 'in_progress');
  const upNextTasks = tasks.filter((t) => t.priority === 'up_next' && t.status !== 'in_progress' && t.status !== 'complete');

  const sections: SectionData[] = [
    { title: 'URGENT', color: '#fc5c65', data: urgentTasks },
    { title: 'IN PROGRESS', color: '#3b82f6', data: inProgressTasks },
    { title: 'UP NEXT', color: '#6b7280', data: upNextTasks },
  ];

  const stats = [
    {
      label: 'Remaining',
      value: urgentTasks.length + upNextTasks.length,
      color: '#0d9488',
    },
    { label: 'Done Today', value: completedToday },
    { label: 'Avg Time (min)', value: avgTime > 0 ? avgTime : '—' },
  ];

  const shiftEndFormatted = shiftEnd
    ? format(new Date(shiftEnd), 'h:mm a')
    : '—';

  const renderSectionHeader = (section: SectionData) => (
    <View
      style={[styles.sectionHeader, { borderLeftColor: section.color }]}
      key={section.title}
    >
      <Text style={[styles.sectionTitle, { color: section.color }]}>
        {section.title}
      </Text>
      <Text style={styles.sectionCount}>{section.data.length}</Text>
    </View>
  );

  const allItems: Array<{ type: 'header'; section: SectionData } | { type: 'task'; task: Task }> = [];
  for (const section of sections) {
    if (section.data.length > 0) {
      allItems.push({ type: 'header', section });
      for (const task of section.data) {
        allItems.push({ type: 'task', task });
      }
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0d9488" />
          <Text style={styles.loadingText}>Loading your task queue...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => void fetchTasks()}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={allItems}
        keyExtractor={(item) =>
          item.type === 'header' ? `header-${item.section.title}` : item.task.id
        }
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return renderSectionHeader(item.section);
          }
          return (
            <TaskCard
              task={item.task}
              onStart={() => handleStart(item.task)}
            />
          );
        }}
        ListHeaderComponent={
          <>
            {/* Page header */}
            <View style={styles.pageHeader}>
              <Text style={styles.pageTitle}>Task Queue</Text>
              <Text style={styles.pageDate}>{format(new Date(), 'EEE, MMM d')}</Text>
            </View>

            {/* Shift card */}
            <View style={styles.shiftCard}>
              <View style={styles.shiftRow}>
                <View>
                  <Text style={styles.staffName}>{user?.name ?? 'Staff Member'}</Text>
                  <Text style={styles.shiftDetail}>
                    {wingName || user?.wingName || 'Unassigned'} · Shift ends {shiftEndFormatted}
                  </Text>
                </View>
                <Badge type="on_shift" label="On Shift" />
              </View>
            </View>

            {/* Stats */}
            <StatStrip stats={stats} />
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>
              No tasks in your queue right now.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#0d9488"
            colors={['#0d9488']}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 15,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#0d9488',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  listContent: {
    paddingBottom: 24,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  pageDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  shiftCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  shiftRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  staffName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
  },
  shiftDetail: {
    fontSize: 13,
    color: '#6b7280',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    paddingLeft: 8,
    borderLeftWidth: 3,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
  },
});
