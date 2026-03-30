import React from 'react'
import { View, Text, StyleSheet, SafeAreaView } from 'react-native'

// Phase 4 stub — Real-time floor map
export default function MapScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Floor Map</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.mapOutline}>
          {/* Simplified floor plan illustration */}
          <View style={styles.corridor} />
          <View style={styles.roomRow}>
            {[1, 2, 3, 4].map((n) => (
              <View key={n} style={styles.roomBox}>
                <Text style={styles.roomBoxText}>{200 + n}</Text>
              </View>
            ))}
          </View>
          <View style={styles.corridor} />
          <View style={styles.roomRow}>
            {[5, 6, 7, 8].map((n) => (
              <View key={n} style={[styles.roomBox, styles.roomBoxBottom]}>
                <Text style={styles.roomBoxText}>{200 + n}</Text>
              </View>
            ))}
          </View>
          {/* Staff location dot placeholder */}
          <View style={styles.staffDot}>
            <Text style={styles.staffDotText}>You</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Real-time Floor Map</Text>
          <Text style={styles.infoBody}>
            Coming in Phase 4 — will display the hospital floor plan with live staff locations,
            active job routes, and room status overlays.
          </Text>
          <View style={styles.featureList}>
            {[
              'Live staff location tracking',
              'Active transport route display',
              'Room status color overlay',
              'Turn-by-turn navigation',
            ].map((f) => (
              <View key={f} style={styles.featureItem}>
                <Text style={styles.featureDot}>·</Text>
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
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
  content: { flex: 1, padding: 16, gap: 16 },
  mapOutline: {
    backgroundColor: '#e5e7eb',
    borderRadius: 16,
    padding: 20,
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    position: 'relative',
  },
  corridor: {
    width: '100%',
    height: 10,
    backgroundColor: '#d1d5db',
    borderRadius: 4,
  },
  roomRow: { flexDirection: 'row', gap: 6 },
  roomBox: {
    width: 52,
    height: 40,
    backgroundColor: '#9ca3af',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.6,
  },
  roomBoxBottom: { backgroundColor: '#6b7280' },
  roomBoxText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  staffDot: {
    position: 'absolute',
    bottom: 30,
    right: 40,
    backgroundColor: '#0d9488',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#0d9488',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  staffDotText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#0d9488',
  },
  infoTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  infoBody: { fontSize: 14, color: '#6b7280', lineHeight: 20 },
  featureList: { gap: 6 },
  featureItem: { flexDirection: 'row', gap: 6 },
  featureDot: { fontSize: 16, color: '#0d9488', lineHeight: 20 },
  featureText: { fontSize: 13, color: '#374151', flex: 1, lineHeight: 20 },
})
