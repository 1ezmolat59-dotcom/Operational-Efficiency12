import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { TransportJob } from '../types';
import Badge from './Badge';

interface JobCardProps {
  job: TransportJob;
  onAccept: () => void;
  onDecline: () => void;
}

function formatPatientName(fullName: string): string {
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1][0];
  return `${firstName} ${lastInitial}.`;
}

function jobTypeLabel(jobType: string): string {
  switch (jobType) {
    case 'stat':
      return 'STAT';
    case 'radiology':
      return 'Radiology';
    case 'discharge':
      return 'Discharge';
    case 'routine':
      return 'Routine';
    default:
      return jobType;
  }
}

function equipmentLabel(eq: string): string {
  switch (eq) {
    case 'wheelchair':
      return 'Wheelchair';
    case 'stretcher':
      return 'Stretcher';
    case 'none':
      return 'No Equipment';
    default:
      return eq;
  }
}

export default function JobCard({ job, onAccept, onDecline }: JobCardProps) {
  const isStat = job.priority === 'stat';
  const timeAgo = formatDistanceToNow(new Date(job.createdAt), {
    addSuffix: true,
  });

  return (
    <View style={[styles.card, isStat ? styles.statCard : null]}>
      {isStat && (
        <View style={styles.statBanner}>
          <Text style={styles.statBannerText}>URGENT — STAT JOB</Text>
        </View>
      )}

      <View style={styles.topRow}>
        <View style={styles.jobInfo}>
          <Text style={styles.patientName}>
            {formatPatientName(job.patientName)}
          </Text>
          <View style={styles.badgeRow}>
            <Badge type={job.jobType} label={jobTypeLabel(job.jobType)} size="sm" />
            <View style={styles.badgeGap} />
            <Badge
              type={job.equipment}
              label={equipmentLabel(job.equipment)}
              size="sm"
            />
          </View>
        </View>
      </View>

      <View style={styles.routeRow}>
        <Text style={styles.routeText} numberOfLines={1}>
          {job.fromLocation}
        </Text>
        <Text style={styles.routeArrow}> → </Text>
        <Text style={styles.routeText} numberOfLines={1}>
          {job.toLocation}
        </Text>
      </View>

      {job.requesterName ? (
        <Text style={styles.requester}>Requested by {job.requesterName}</Text>
      ) : null}

      <Text style={styles.timeAgo}>{timeAgo}</Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.declineButton}
          onPress={onDecline}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          accessibilityLabel={`Decline transport job for ${formatPatientName(job.patientName)}`}
          accessibilityRole="button"
        >
          <Text style={styles.declineText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={onAccept}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          accessibilityLabel={`Accept transport job for ${formatPatientName(job.patientName)}`}
          accessibilityRole="button"
        >
          <Text style={styles.acceptText}>Accept</Text>
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
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    overflow: 'hidden',
  },
  statCard: {
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  statBanner: {
    backgroundColor: '#fee2e2',
    marginHorizontal: -14,
    marginTop: -14,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 10,
  },
  statBannerText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  jobInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeGap: {
    width: 6,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  routeText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  routeArrow: {
    fontSize: 14,
    color: '#9ca3af',
    marginHorizontal: 2,
  },
  requester: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  timeAgo: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  declineText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 14,
  },
  acceptButton: {
    flex: 2,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  acceptText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});
