import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { jobsApi } from '../../src/api/client'
import { useAuth } from '../../src/contexts/AuthContext'
import StatStrip from '../../src/components/StatStrip'
import JobCard from '../../src/components/JobCard'
import StatusToggle from '../../src/components/StatusToggle'
import type { TransportJob } from '../../src/types'

export default function JobQueueScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const [jobs, setJobs] = useState<TransportJob[]>([])
  const [activeJob, setActiveJob] = useState<TransportJob | null>(null)
  const [available, setAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState({ inQueue: 0, doneToday: 0, avgTime: 0 })

  const fetchJobs = useCallback(async () => {
    try {
      const data = await jobsApi.getJobQueue()
      const active = data.find(
        (j: TransportJob) => j.status === 'accepted' || j.status === 'in_progress'
      )
      const incoming = data.filter(
        (j: TransportJob) => j.status === 'requested'
      )
      // Sort: stat first, then by createdAt
      incoming.sort((a: TransportJob, b: TransportJob) => {
        if (a.priority === 'stat' && b.priority !== 'stat') return -1
        if (b.priority === 'stat' && a.priority !== 'stat') return 1
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      })
      setActiveJob(active || null)
      setJobs(incoming)
      setStats({
        inQueue: incoming.length,
        doneToday: data.filter((j: TransportJob) => j.status === 'complete').length,
        avgTime: 18, // Would be calculated from history
      })
    } catch {
      // Network error — keep showing last data
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchJobs()
  }

  const handleAvailabilityToggle = async (value: boolean) => {
    setAvailable(value)
    try {
      await jobsApi.updateAvailability(value)
    } catch {
      setAvailable(!value)
      Alert.alert('Error', 'Could not update availability. Please try again.')
    }
  }

  const handleAccept = async (jobId: string) => {
    try {
      await jobsApi.acceptJob(jobId)
      fetchJobs()
    } catch {
      Alert.alert('Error', 'Could not accept job. It may have been reassigned.')
      fetchJobs()
    }
  }

  const handleDecline = async (jobId: string) => {
    try {
      await jobsApi.declineJob(jobId)
      fetchJobs()
    } catch {
      Alert.alert('Error', 'Could not decline job.')
    }
  }

  const handleMarkDelivered = async () => {
    if (!activeJob) return
    try {
      await jobsApi.updateJobStatus(activeJob.id, 'complete')
      setActiveJob(null)
      fetchJobs()
    } catch {
      Alert.alert('Error', 'Could not update job status.')
    }
  }

  const getProgressLabel = (job: TransportJob) => {
    if (job.status === 'accepted') return 'Accepted — tap to update status'
    if (job.status === 'in_progress') return 'En route / In progress'
    return ''
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerName}>{user?.name ?? 'Transporter'}</Text>
          <Text style={styles.headerRole}>Transport Staff</Text>
        </View>
        <StatusToggle available={available} onToggle={handleAvailabilityToggle} />
      </View>

      {!available && (
        <View style={styles.unavailableBanner}>
          <Text style={styles.unavailableText}>
            You are unavailable — no new jobs will be dispatched to you
          </Text>
        </View>
      )}

      {/* Stat strip */}
      <StatStrip
        stats={[
          { label: 'In Queue', value: stats.inQueue },
          { label: 'Done Today', value: stats.doneToday, color: '#10b981' },
          { label: 'Avg Time (min)', value: stats.avgTime },
        ]}
      />

      {/* Active job banner */}
      {activeJob && (
        <View style={styles.activeJobBanner}>
          <View style={styles.activeJobHeader}>
            <Text style={styles.activeJobLabel}>ACTIVE JOB</Text>
            <Text style={styles.activeJobPatient}>{activeJob.patientName}</Text>
          </View>
          <Text style={styles.activeJobRoute}>
            {activeJob.fromLocation} → {activeJob.toLocation}
          </Text>
          <Text style={styles.activeJobProgress}>{getProgressLabel(activeJob)}</Text>
          <View style={styles.activeJobActions}>
            {activeJob.status === 'accepted' && (
              <TouchableOpacity
                style={styles.enRouteButton}
                onPress={async () => {
                  await jobsApi.updateJobStatus(activeJob.id, 'in_progress')
                  fetchJobs()
                }}
              >
                <Text style={styles.buttonText}>Mark En Route</Text>
              </TouchableOpacity>
            )}
            {activeJob.status === 'in_progress' && (
              <TouchableOpacity
                style={styles.deliveredButton}
                onPress={handleMarkDelivered}
              >
                <Text style={styles.buttonText}>Mark Delivered</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.detailButton}
              onPress={() => router.push({ pathname: '/(transporter)/job-detail', params: { jobId: activeJob.id } })}
            >
              <Text style={styles.detailButtonText}>View Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Incoming jobs */}
      <Text style={styles.sectionHeader}>INCOMING JOBS</Text>
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <JobCard
            job={item}
            onAccept={() => handleAccept(item.id)}
            onDecline={() => handleDecline(item.id)}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✓</Text>
              <Text style={styles.emptyText}>No incoming jobs</Text>
              <Text style={styles.emptySubtext}>New jobs will appear here when dispatched</Text>
            </View>
          )
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#0d9488',
  },
  headerName: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerRole: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  unavailableBanner: {
    backgroundColor: '#fef3c7',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#fcd34d',
  },
  unavailableText: { color: '#92400e', fontSize: 13, textAlign: 'center' },
  activeJobBanner: {
    margin: 12,
    backgroundColor: '#0d9488',
    borderRadius: 12,
    padding: 16,
  },
  activeJobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  activeJobLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
  },
  activeJobPatient: { fontSize: 16, fontWeight: '700', color: '#fff' },
  activeJobRoute: { fontSize: 15, color: 'rgba(255,255,255,0.9)', marginBottom: 4 },
  activeJobProgress: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 12 },
  activeJobActions: { flexDirection: 'row', gap: 8 },
  enRouteButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  deliveredButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  detailButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
  },
  buttonText: { color: '#0d9488', fontWeight: '600', fontSize: 14 },
  detailButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 17, fontWeight: '600', color: '#374151', marginBottom: 6 },
  emptySubtext: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
})
