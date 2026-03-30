import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Task, CleanType } from '../types';
import Badge from './Badge';

interface TaskCardProps {
  task: Task;
  onStart: () => void;
}

function cleanTypeLabel(cleanType: CleanType): string {
  switch (cleanType) {
    case 'discharge':
      return 'Discharge Clean';
    case 'checkout':
      return 'Checkout';
    case 'routine':
      return 'Routine';
    default:
      return cleanType;
  }
}

function elapsedLabel(minutes: number): string {
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

export default function TaskCard({ task, onStart }: TaskCardProps) {
  const isInProgress = task.status === 'in_progress';
  const progress =
    isInProgress && task.totalSteps && task.currentStep
      ? task.currentStep / task.totalSteps
      : 0;

  const badgeType =
    task.status === 'in_progress'
      ? 'in_progress'
      : task.cleanType;

  const badgeLabel =
    task.status === 'in_progress'
      ? 'In Progress'
      : cleanTypeLabel(task.cleanType);

  const estimatedRemaining =
    isInProgress && task.estimatedMinutes && task.elapsedMinutes
      ? Math.max(0, task.estimatedMinutes - task.elapsedMinutes)
      : task.estimatedMinutes;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.roomInfo}>
          <Text style={styles.roomNumber}>Room {task.roomNumber}</Text>
          {task.wingName ? (
            <Text style={styles.wing}>{task.wingName}</Text>
          ) : null}
        </View>
        <Badge type={badgeType} label={badgeLabel} />
      </View>

      {task.requestedBy ? (
        <Text style={styles.requestedBy}>Requested by {task.requestedBy}</Text>
      ) : null}

      {task.patientName && task.cleanType === 'discharge' ? (
        <Text style={styles.patient}>Patient: {task.patientName}</Text>
      ) : null}

      {isInProgress && task.totalSteps && task.currentStep ? (
        <View style={styles.progressSection}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>
              Step {task.currentStep} of {task.totalSteps}
            </Text>
            <Text style={styles.progressLabel}>
              ~{estimatedRemaining} min remaining
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(progress * 100)}%` },
              ]}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.bottomRow}>
        <Text style={styles.elapsed}>{elapsedLabel(task.elapsedMinutes)}</Text>
        <TouchableOpacity
          style={[
            styles.startButton,
            isInProgress ? styles.resumeButton : null,
          ]}
          onPress={onStart}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={
            isInProgress
              ? `Resume cleaning room ${task.roomNumber}`
              : `Start cleaning room ${task.roomNumber}`
          }
          accessibilityRole="button"
        >
          <Text style={styles.startButtonText}>
            {isInProgress ? 'Resume' : 'Start'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 5,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  roomInfo: {
    flex: 1,
    marginRight: 8,
  },
  roomNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  wing: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 1,
  },
  requestedBy: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  patient: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 4,
  },
  progressSection: {
    marginTop: 8,
    marginBottom: 4,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 3,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  elapsed: {
    fontSize: 12,
    color: '#9ca3af',
  },
  startButton: {
    backgroundColor: '#0d9488',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  resumeButton: {
    backgroundColor: '#3b82f6',
  },
  startButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});
