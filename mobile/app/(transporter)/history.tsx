import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { formatDistanceToNow, format } from 'date-fns'
import { jobsApi } from '../../src/api/client'
import Badge from '../../src/components/Badge'
import type { TransportJob } from '../../src/types'

export default function HistoryScreen() {
  const [jobs, setJobs] = useState<TransportJob[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchHistory = useCallback(async () => {
    try {
      const data = await jobsApi.getJobHistory()
      setJobs(data)
    } catch {
      // Keep previous data on error
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const getDuration = (job: TransportJob) => {
    const requested = job.timestamps?.requested
    const completed = job.timestamps?.complete
    if (!requested || !completed) return '—'
    const mins = Math.round(
      (new Date(completed).getTime() - new Date(requested).getTime()) / 60_000
    )
    return `${mins} min`
  }

  const renderItem = ({ item }: { item: TransportJob }) => {
    // PHI: first name + last initial
    const displayName =
      item.patientName.split(' ').length > 1
        ? `${item.patientName.split(' ')[0]} ${item.patientName.split(' ').slice(-1)[0][0]}.`
        : item.patientName

    return (
      <View style={styles.jobItem}>
        <View style={styles.jobTop}>
          <Badge type={item.jobType} label={item.jobType} />
          <Text style={styles.duration}>{getDuration(item)}</Text>
        </View>
        <Text style={styles.patient}>{displayName}</Text>
        <Text style={styles.route}>
          {item.fromLocation} → {item.toLocation}
        </Text>
        <Text style={styles.time}>
          {item.timestamps?.complete
            ? format(new Date(item.timestamps.complete), 'MMM d, h:mm a')
            : formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
        </Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Job History</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0d9488" />
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHistory() }} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No completed jobs yet</Text>
            </View>
          }
          contentContainerStyle={{ padding: 16, gap: 10 }}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#9ca3af', fontSize: 15 },
  jobItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    gap: 4,
  },
  jobTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  duration: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  patient: { fontSize: 15, fontWeight: '600', color: '#111827' },
  route: { fontSize: 14, color: '#6b7280' },
  time: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
})
