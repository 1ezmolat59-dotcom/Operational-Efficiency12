import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { suppliesApi } from '@/api/client';
import { useOffline } from '@/contexts/OfflineContext';
import { SupplyLog } from '@/types';

interface CounterProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
}

function Counter({ label, value, onChange }: CounterProps) {
  return (
    <View style={styles.counterRow}>
      <Text style={styles.counterLabel}>{label}</Text>
      <View style={styles.counterControls}>
        <TouchableOpacity
          style={styles.counterBtn}
          onPress={() => onChange(Math.max(0, value - 1))}
          accessibilityLabel={`Decrease ${label}`}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.counterBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.counterValue}>{value}</Text>
        <TouchableOpacity
          style={styles.counterBtn}
          onPress={() => onChange(value + 1)}
          accessibilityLabel={`Increase ${label}`}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.counterBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Predefined rooms for demonstration — in production, these would come from API
const ROOMS = ['101', '102', '103', '104', '201', '202', '203', '204'];

export default function SuppliesScreen() {
  const { addToQueue, isOnline } = useOffline();
  const [selectedRoom, setSelectedRoom] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [sheets, setSheets] = useState(0);
  const [pillowcases, setPillowcases] = useState(0);
  const [towels, setTowels] = useState(0);
  const [gowns, setGowns] = useState(0);
  const [flaggedLow, setFlaggedLow] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentLogs, setRecentLogs] = useState<SupplyLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [showRoomPicker, setShowRoomPicker] = useState(false);

  const fetchLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const logs = await suppliesApi.getRecentLogs(5);
      setRecentLogs(logs);
    } catch {
      // Silently fail — logs are cosmetic
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const resetForm = useCallback(() => {
    setSheets(0);
    setPillowcases(0);
    setTowels(0);
    setGowns(0);
    setFlaggedLow(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    const roomId = selectedRoom || roomInput.trim();
    if (!roomId) {
      Alert.alert('Room Required', 'Please select or enter a room number.');
      return;
    }

    if (sheets === 0 && pillowcases === 0 && towels === 0 && gowns === 0 && !flaggedLow) {
      Alert.alert('No Data', 'Please enter at least one supply count or flag the cart as low.');
      return;
    }

    setIsSubmitting(true);
    const entry = {
      roomId,
      sheets,
      pillowcases,
      towels,
      gowns,
      flaggedLow,
    };

    if (!isOnline) {
      await addToQueue({
        id: `supplies_${roomId}_${Date.now()}`,
        type: 'log_supplies',
        data: entry as unknown as Record<string, unknown>,
        timestamp: new Date().toISOString(),
        retries: 0,
      });
      setIsSubmitting(false);
      resetForm();
      Alert.alert('Saved Offline', 'Supply log saved and will sync when you reconnect.');
      return;
    }

    try {
      await suppliesApi.logSupplies(entry);
      if (flaggedLow) {
        await suppliesApi.flagLow(roomId);
      }
      resetForm();
      Alert.alert('Success', `Supply usage logged for Room ${roomId}.`);
      void fetchLogs();
    } catch {
      Alert.alert(
        'Submission Failed',
        'Could not log supplies. Would you like to save offline?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save Offline',
            onPress: async () => {
              await addToQueue({
                id: `supplies_${roomId}_${Date.now()}`,
                type: 'log_supplies',
                data: entry as unknown as Record<string, unknown>,
                timestamp: new Date().toISOString(),
                retries: 0,
              });
              resetForm();
            },
          },
        ],
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedRoom,
    roomInput,
    sheets,
    pillowcases,
    towels,
    gowns,
    flaggedLow,
    isOnline,
    addToQueue,
    resetForm,
    fetchLogs,
  ]);

  const activeRoom = selectedRoom || roomInput.trim();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pageTitle}>Linen & Supplies</Text>
          <Text style={styles.pageSubtitle}>Log usage after cleaning a room</Text>

          {/* Room selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SELECT ROOM</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.roomPickerBtn}
                onPress={() => setShowRoomPicker(!showRoomPicker)}
                accessibilityRole="button"
                accessibilityLabel="Select room"
              >
                <Text style={[styles.roomPickerText, !activeRoom ? styles.roomPickerPlaceholder : null]}>
                  {activeRoom ? `Room ${activeRoom}` : 'Select a room...'}
                </Text>
                <Text style={styles.roomPickerChevron}>
                  {showRoomPicker ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>

              {showRoomPicker && (
                <View style={styles.roomList}>
                  {ROOMS.map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.roomOption,
                        selectedRoom === r ? styles.roomOptionSelected : null,
                      ]}
                      onPress={() => {
                        setSelectedRoom(r);
                        setRoomInput('');
                        setShowRoomPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.roomOptionText,
                          selectedRoom === r ? styles.roomOptionTextSelected : null,
                        ]}
                      >
                        Room {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <View style={styles.roomManualInput}>
                    <TextInput
                      style={styles.roomTextInput}
                      value={roomInput}
                      onChangeText={(t) => {
                        setRoomInput(t);
                        setSelectedRoom('');
                      }}
                      placeholder="Or type room number..."
                      placeholderTextColor="#9ca3af"
                      keyboardType="default"
                      returnKeyType="done"
                      onSubmitEditing={() => setShowRoomPicker(false)}
                    />
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Linen counts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>LINEN USED</Text>
            <View style={styles.card}>
              <Counter label="Sheets" value={sheets} onChange={setSheets} />
              <Counter label="Pillowcases" value={pillowcases} onChange={setPillowcases} />
              <Counter label="Towels" value={towels} onChange={setTowels} />
              <Counter label="Gowns" value={gowns} onChange={setGowns} />
            </View>
          </View>

          {/* Low cart flag */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CART STATUS</Text>
            <View style={[styles.card, styles.flagRow]}>
              <View style={styles.flagInfo}>
                <Text style={styles.flagLabel}>Flag cart as low</Text>
                <Text style={styles.flagSubtitle}>
                  Alerts supervisor to restock supplies
                </Text>
              </View>
              <Switch
                value={flaggedLow}
                onValueChange={setFlaggedLow}
                trackColor={{ false: '#d1d5db', true: '#fca5a5' }}
                thumbColor={flaggedLow ? '#dc2626' : '#9ca3af'}
                ios_backgroundColor="#d1d5db"
                accessibilityLabel="Flag cart as low"
              />
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, (!activeRoom || isSubmitting) ? styles.submitBtnDisabled : null]}
            onPress={() => void handleSubmit()}
            disabled={!activeRoom || isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Log supply usage"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Log Usage</Text>
            )}
          </TouchableOpacity>

          {/* Recent logs */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>RECENT LOGS</Text>
            {isLoadingLogs ? (
              <ActivityIndicator color="#0d9488" style={styles.logsLoader} />
            ) : recentLogs.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.emptyLogsText}>No recent logs found.</Text>
              </View>
            ) : (
              <View style={styles.card}>
                {recentLogs.map((log, index) => (
                  <View
                    key={log.id}
                    style={[
                      styles.logItem,
                      index < recentLogs.length - 1 ? styles.logItemBorder : null,
                    ]}
                  >
                    <View style={styles.logHeader}>
                      <Text style={styles.logRoom}>Room {log.roomId}</Text>
                      <Text style={styles.logTime}>
                        {format(new Date(log.loggedAt), 'h:mm a, MMM d')}
                      </Text>
                    </View>
                    <Text style={styles.logDetail}>
                      Sheets: {log.sheets} · Pillowcases: {log.pillowcases} · Towels: {log.towels} · Gowns: {log.gowns}
                      {log.flaggedLow ? ' · ⚠ Low' : ''}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  flex: {
    flex: 1,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  roomPickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    minHeight: 52,
  },
  roomPickerText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  roomPickerPlaceholder: {
    color: '#9ca3af',
    fontWeight: '400',
  },
  roomPickerChevron: {
    fontSize: 12,
    color: '#9ca3af',
  },
  roomList: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  roomOption: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    minHeight: 44,
    justifyContent: 'center',
  },
  roomOptionSelected: {
    backgroundColor: '#f0fdf4',
  },
  roomOptionText: {
    fontSize: 15,
    color: '#374151',
  },
  roomOptionTextSelected: {
    color: '#0d9488',
    fontWeight: '600',
  },
  roomManualInput: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  roomTextInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    minHeight: 44,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    minHeight: 56,
  },
  counterLabel: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  counterBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  counterBtnText: {
    fontSize: 20,
    color: '#374151',
    fontWeight: '600',
    lineHeight: 22,
  },
  counterValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    minWidth: 32,
    textAlign: 'center',
  },
  flagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    minHeight: 64,
  },
  flagInfo: {
    flex: 1,
    marginRight: 16,
  },
  flagLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  flagSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  submitBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
    minHeight: 54,
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  logsLoader: {
    padding: 24,
  },
  emptyLogsText: {
    padding: 16,
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
  },
  logItem: {
    padding: 14,
  },
  logItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  logRoom: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  logTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  logDetail: {
    fontSize: 13,
    color: '#6b7280',
  },
});
