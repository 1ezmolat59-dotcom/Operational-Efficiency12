import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import { useAuth } from '../../src/contexts/AuthContext'

export default function HousekeeperProfileScreen() {
  const { user, logout } = useAuth()

  const stats = [
    { label: 'Tasks Today', value: '12' },
    { label: 'Avg Time', value: '22 min' },
    { label: 'Compliance', value: '98%' },
    { label: 'This Week', value: '54' },
  ]

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Avatar + name */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.role}>Housekeeping Staff</Text>
          {user?.wingId && (
            <View style={styles.wingBadge}>
              <Text style={styles.wingText}>Wing {user.wingId}</Text>
            </View>
          )}
        </View>

        {/* Shift info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Current Shift</Text>
          <View style={styles.shiftRow}>
            <View style={styles.shiftItem}>
              <Text style={styles.shiftLabel}>Start</Text>
              <Text style={styles.shiftValue}>7:00 AM</Text>
            </View>
            <View style={styles.shiftDivider} />
            <View style={styles.shiftItem}>
              <Text style={styles.shiftLabel}>End</Text>
              <Text style={styles.shiftValue}>3:00 PM</Text>
            </View>
            <View style={styles.shiftDivider} />
            <View style={styles.shiftItem}>
              <Text style={styles.shiftLabel}>Type</Text>
              <Text style={styles.shiftValue}>Day</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Performance</Text>
          <View style={styles.statsGrid}>
            {stats.map((s) => (
              <View key={s.label} style={styles.statItem}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* App info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>App</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Role</Text>
            <Text style={styles.infoValue}>Housekeeper</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={logout}
          accessibilityLabel="Log out of Hospital Ops"
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
  profileHeader: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0d9488',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#fff' },
  name: { fontSize: 22, fontWeight: '700', color: '#111827' },
  role: { fontSize: 15, color: '#6b7280' },
  wingBadge: {
    backgroundColor: '#d1fae5',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  wingText: { color: '#065f46', fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },
  shiftRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  shiftItem: { alignItems: 'center', flex: 1 },
  shiftLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 4 },
  shiftValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
  shiftDivider: { width: 1, height: 32, backgroundColor: '#e5e7eb' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statItem: {
    flex: 1,
    minWidth: '40%',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: '#0d9488' },
  statLabel: { fontSize: 12, color: '#6b7280', textAlign: 'center' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: { fontSize: 14, color: '#6b7280' },
  infoValue: { fontSize: 14, fontWeight: '500', color: '#111827' },
  logoutButton: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: { color: '#dc2626', fontWeight: '700', fontSize: 16 },
})
