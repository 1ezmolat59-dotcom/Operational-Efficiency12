import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { format } from 'date-fns'
import { jobsApi } from '../../src/api/client'
import Badge from '../../src/components/Badge'
import type { TransportJob } from '../../src/types'

const STATUS_STEPS = [
  { key: 'requested', label: 'Requested' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'in_progress', label: 'En Route' },
  { key: 'complete', label: 'Delivered' },
]

export default function JobDetailScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>()
  const router = useRouter()
  const [job, setJob] = useState<TransportJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (jobId) fetchJob()
  }, [jobId])

  const fetchJob = async () => {
    try {
      const data = await jobsApi.getJob(jobId!)
      setJob(data)
    } catch {
      Alert.alert('Error', 'Could not load job details.')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (newStatus: string) => {
    if (!job) return
    setUpdating(true)
    try {
      await jobsApi.updateJobStatus(job.id, newStatus)
      await fetchJob()
    } catch {
      Alert.alert('Error', 'Could not update status. Please try again.')
    } finally {
      setUpdating(false)
    }
  }

  const getNextAction = () => {
    if (!job) return null
    if (job.status === 'accepted') {
      return { label: 'Mark En Route', nextStatus: 'in_progress', color: '#3b82f6' }
    }
    if (job.status === 'in_progress') {
      return { label: 'Mark Delivered', nextStatus: 'complete', color: '#10b981' }
    }
    return null
  }

  const currentStepIndex = STATUS_STEPS.findIndex(s => s.key === job?.status)
  const nextAction = getNextAction()

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0d9488" />
        </View>
      </SafeAreaView>
    )
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Job not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backNav}>
          <Text style={styles.backNavText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job Detail</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Job info card */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Badge type={job.jobType} label={job.jobType.charAt(0).toUpperCase() + job.jobType.slice(1)} />
            {job.priority === 'stat' && <Badge type="stat" label="STAT" />}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Patient</Text>
            {/* PHI: first name + last initial only */}
            <Text style={styles.infoValue}>
              {job.patientName.split(' ').length > 1
                ? `${job.patientName.split(' ')[0]} ${job.patientName.split(' ').slice(-1)[0][0]}.`
                : job.patientName}
            </Text>
          </View>

          <View style={styles.routeContainer}>
            <View style={styles.routeBox}>
              <Text style={styles.routeLabel}>FROM</Text>
              <Text style={styles.routeValue}>{job.fromLocation}</Text>
            </View>
            <Text style={styles.routeArrow}>→</Text>
            <View style={styles.routeBox}>
              <Text style={styles.routeLabel}>TO</Text>
              <Text style={styles.routeValue}>{job.toLocation}</Text>
            </View>
          </View>

          {job.equipment !== 'none' && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Equipment</Text>
              <View style={styles.equipmentBadge}>
                <Text style={styles.equipmentText}>
                  {job.equipment === 'wheelchair' ? '♿ Wheelchair' : '🛏 Stretcher'}
                </Text>
              </View>
            </View>
          )}

          {job.requesterName && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Requested by</Text>
              <Text style={styles.infoValue}>{job.requesterName}</Text>
            </View>
          )}
        </View>

        {/* Status timeline */}
        <Text style={styles.sectionTitle}>Status Timeline</Text>
        <View style={styles.card}>
          {STATUS_STEPS.map((step, index) => {
            const isCompleted = index <= currentStepIndex
            const isCurrent = index === currentStepIndex
            const timestamp = job.timestamps?.[step.key]

            return (
              <View key={step.key} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View
                    style={[
                      styles.timelineDot,
                      isCompleted && styles.timelineDotCompleted,
                      isCurrent && styles.timelineDotCurrent,
                    ]}
                  />
                  {index < STATUS_STEPS.length - 1 && (
                    <View
                      style={[
                        styles.timelineLine,
                        isCompleted && index < currentStepIndex && styles.timelineLineCompleted,
                      ]}
                    />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <Text
                    style={[
                      styles.timelineLabel,
                      !isCompleted && styles.timelineLabelInactive,
                      isCurrent && styles.timelineLabelCurrent,
                    ]}
                  >
                    {step.label}
                  </Text>
                  {timestamp && (
                    <Text style={styles.timelineTime}>
                      {format(new Date(timestamp), 'h:mm a')}
                    </Text>
                  )}
                </View>
              </View>
            )
          })}
        </View>

        {/* Action button */}
        {nextAction && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: nextAction.color }, updating && styles.actionButtonDisabled]}
            onPress={() => handleStatusUpdate(nextAction.nextStatus)}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>{nextAction.label}</Text>
            )}
          </TouchableOpacity>
        )}

        {job.status === 'complete' && (
          <View style={styles.completedCard}>
            <Text style={styles.completedIcon}>✓</Text>
            <Text style={styles.completedText}>Job Completed</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#6b7280', marginBottom: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backNav: { padding: 4 },
  backNavText: { color: '#0d9488', fontSize: 16 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#111827' },
  backButton: {
    marginTop: 12,
    backgroundColor: '#0d9488',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  backButtonText: { color: '#fff', fontWeight: '600' },
  scrollContent: { padding: 16, gap: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    gap: 12,
  },
  cardRow: { flexDirection: 'row', gap: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 14, color: '#6b7280' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  routeContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeBox: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 8, padding: 10 },
  routeLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '600', letterSpacing: 0.5, marginBottom: 2 },
  routeValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  routeArrow: { fontSize: 20, color: '#9ca3af' },
  equipmentBadge: {
    backgroundColor: '#ede9fe',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  equipmentText: { color: '#7c3aed', fontSize: 13, fontWeight: '500' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginTop: 4 },
  timelineItem: { flexDirection: 'row', gap: 12, minHeight: 48 },
  timelineLeft: { alignItems: 'center', width: 20 },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#e5e7eb',
    borderWidth: 2,
    borderColor: '#d1d5db',
  },
  timelineDotCompleted: { backgroundColor: '#10b981', borderColor: '#10b981' },
  timelineDotCurrent: { backgroundColor: '#0d9488', borderColor: '#0d9488', width: 16, height: 16, borderRadius: 8 },
  timelineLine: { flex: 1, width: 2, backgroundColor: '#e5e7eb', marginVertical: 2 },
  timelineLineCompleted: { backgroundColor: '#10b981' },
  timelineContent: { flex: 1, paddingBottom: 16 },
  timelineLabel: { fontSize: 15, color: '#9ca3af' },
  timelineLabelInactive: { color: '#d1d5db' },
  timelineLabelCurrent: { color: '#0d9488', fontWeight: '700' },
  timelineTime: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  actionButtonDisabled: { opacity: 0.6 },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  completedCard: {
    backgroundColor: '#d1fae5',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  completedIcon: { fontSize: 32, color: '#10b981' },
  completedText: { fontSize: 16, fontWeight: '700', color: '#065f46' },
})
