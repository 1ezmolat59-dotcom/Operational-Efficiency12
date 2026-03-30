import React from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  Platform,
} from 'react-native';

interface StatusToggleProps {
  available: boolean;
  onToggle: () => void;
}

export default function StatusToggle({ available, onToggle }: StatusToggleProps) {
  return (
    <View style={[styles.container, available ? styles.containerAvailable : styles.containerUnavailable]}>
      <View style={styles.content}>
        <View>
          <Text style={styles.statusLabel}>Availability Status</Text>
          <Text style={[styles.statusValue, available ? styles.statusAvailable : styles.statusUnavailable]}>
            {available ? 'Available' : 'Unavailable'}
          </Text>
        </View>
        <Switch
          value={available}
          onValueChange={onToggle}
          trackColor={{ false: '#d1d5db', true: '#6ee7b7' }}
          thumbColor={available ? '#10b981' : '#9ca3af'}
          ios_backgroundColor="#d1d5db"
          accessibilityLabel={available ? 'You are available for jobs' : 'You are unavailable for jobs'}
          accessibilityRole="switch"
          style={Platform.OS === 'android' ? styles.switchAndroid : undefined}
        />
      </View>
      {!available && (
        <Text style={styles.unavailableNote}>
          You are unavailable — no new jobs will be dispatched to you
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
  },
  containerAvailable: {
    backgroundColor: '#d1fae5',
  },
  containerUnavailable: {
    backgroundColor: '#f3f4f6',
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statusAvailable: {
    color: '#065f46',
  },
  statusUnavailable: {
    color: '#374151',
  },
  unavailableNote: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  switchAndroid: {
    transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }],
  },
});
