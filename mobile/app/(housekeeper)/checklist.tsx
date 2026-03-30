import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checklistApi, tasksApi } from '@/api/client';
import { useOffline } from '@/contexts/OfflineContext';
import { ChecklistStep, CleanType } from '@/types';
import ChecklistItem from '@/components/ChecklistItem';
import Badge from '@/components/Badge';
import PhotoSlot from '@/components/PhotoSlot';

const PHOTO_SLOT_COUNT = 2;

interface SectionData {
  title: string;
  data: ChecklistStep[];
}

export default function ChecklistScreen() {
  const params = useLocalSearchParams<{
    taskId: string;
    roomId: string;
    roomNumber: string;
    cleanType: string;
    patientName: string;
  }>();
  const router = useRouter();
  const { addToQueue, isOnline } = useOffline();

  const taskId = params.taskId ?? '';
  const roomId = params.roomId ?? '';
  const roomNumber = params.roomNumber ?? '';
  const cleanType = (params.cleanType ?? 'routine') as CleanType;
  const patientName = params.patientName ?? '';

  const [steps, setSteps] = useState<ChecklistStep[]>([]);
  const [photoUris, setPhotoUris] = useState<Array<string | undefined>>(
    Array(PHOTO_SLOT_COUNT).fill(undefined),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startTime] = useState(new Date());
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [missingItems, setMissingItems] = useState<string[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const storageKey = `checklist_${roomId}`;

  // Load checklist + restore saved progress
  useEffect(() => {
    const loadChecklist = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [apiSteps, savedRaw] = await Promise.all([
          checklistApi.getChecklist(roomId, cleanType),
          AsyncStorage.getItem(storageKey),
        ]);

        if (savedRaw) {
          const saved: Record<string, boolean> = JSON.parse(savedRaw) as Record<string, boolean>;
          const merged = apiSteps.map((s) => ({
            ...s,
            checked: saved[s.id] ?? s.checked,
          }));
          setSteps(merged);
        } else {
          setSteps(apiSteps);
        }
      } catch {
        // If API fails, try to use cached version
        const savedRaw = await AsyncStorage.getItem(storageKey);
        if (savedRaw) {
          setError('Loaded from cache — some data may be outdated.');
        } else {
          setError('Unable to load checklist. Check your connection and retry.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    void loadChecklist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, cleanType]);

  // Auto-save step state to AsyncStorage (debounced)
  const saveProgress = useCallback(
    (updatedSteps: ChecklistStep[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        const stateMap: Record<string, boolean> = {};
        updatedSteps.forEach((s) => {
          stateMap[s.id] = s.checked;
        });
        await AsyncStorage.setItem(storageKey, JSON.stringify(stateMap));
      }, 300);
    },
    [storageKey],
  );

  const handleToggle = useCallback(
    (id: string) => {
      setSteps((prev) => {
        const next = prev.map((s) => (s.id === id ? { ...s, checked: !s.checked } : s));
        saveProgress(next);
        return next;
      });
    },
    [saveProgress],
  );

  const handlePhotoCapture = useCallback((index: number, uri: string) => {
    setPhotoUris((prev) => {
      const next = [...prev];
      next[index] = uri;
      return next;
    });
  }, []);

  const allStepsChecked = steps.length > 0 && steps.every((s) => s.checked);
  const allPhotosCaptures = photoUris.every((u) => u !== undefined);
  const canSubmit = allStepsChecked && allPhotosCaptures;

  const checkedCount = steps.filter((s) => s.checked).length;
  const totalCount = steps.length;
  const progress = totalCount > 0 ? checkedCount / totalCount : 0;

  const getMissingItems = useCallback((): string[] => {
    const missing: string[] = [];
    const unchecked = steps.filter((s) => !s.checked);
    if (unchecked.length > 0) {
      missing.push(`${unchecked.length} checklist step${unchecked.length > 1 ? 's' : ''} not completed`);
    }
    photoUris.forEach((uri, i) => {
      if (!uri) missing.push(`Photo ${i + 1} not captured`);
    });
    return missing;
  }, [steps, photoUris]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) {
      setMissingItems(getMissingItems());
      setShowMissingModal(true);
      return;
    }

    Alert.alert(
      'Submit Room as Clean?',
      `Mark Room ${roomNumber} as clean and complete?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          style: 'default',
          onPress: async () => {
            setIsSubmitting(true);
            const completedAt = new Date().toISOString();
            const capturedUris = photoUris.filter((u): u is string => u !== undefined);

            if (!isOnline) {
              // Queue for offline sync
              await addToQueue({
                id: `complete_${taskId}_${Date.now()}`,
                type: 'complete_room',
                data: {
                  taskId,
                  steps,
                  photoUris: capturedUris,
                  completedAt,
                },
                timestamp: new Date().toISOString(),
                retries: 0,
              });
              await AsyncStorage.removeItem(storageKey);
              setIsSubmitting(false);
              Alert.alert(
                'Saved Offline',
                'Room completion saved locally. It will sync when you reconnect.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.back(),
                  },
                ],
              );
              return;
            }

            try {
              await tasksApi.completeRoom(taskId, {
                steps,
                photoUris: capturedUris,
                completedAt,
              });
              await AsyncStorage.removeItem(storageKey);
              router.back();
              // Toast-like feedback via Alert
              Alert.alert('Room Complete', `Room ${roomNumber} marked as clean.`);
            } catch {
              Alert.alert(
                'Submission Failed',
                'Could not submit right now. Would you like to save offline?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Save Offline',
                    onPress: async () => {
                      await addToQueue({
                        id: `complete_${taskId}_${Date.now()}`,
                        type: 'complete_room',
                        data: {
                          taskId,
                          steps,
                          photoUris: capturedUris,
                          completedAt,
                        },
                        timestamp: new Date().toISOString(),
                        retries: 0,
                      });
                      await AsyncStorage.removeItem(storageKey);
                      router.back();
                    },
                  },
                ],
              );
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ],
    );
  }, [
    canSubmit,
    getMissingItems,
    roomNumber,
    photoUris,
    isOnline,
    addToQueue,
    taskId,
    steps,
    storageKey,
    router,
  ]);

  // Build sections from zones
  const sectionMap: Record<string, ChecklistStep[]> = {};
  for (const step of steps) {
    if (!sectionMap[step.zone]) sectionMap[step.zone] = [];
    sectionMap[step.zone].push(step);
  }
  const sections: SectionData[] = Object.entries(sectionMap)
    .map(([title, data]) => ({
      title,
      data: data.sort((a, b) => a.order - b.order),
    }))
    .sort((a, b) => {
      const order = ['Bed Area', 'Bathroom', 'Floor', 'Surfaces', 'Supplies Restocked'];
      return order.indexOf(a.title) - order.indexOf(b.title);
    });

  const cleanTypeBadge =
    cleanType === 'discharge'
      ? 'discharge'
      : cleanType === 'checkout'
      ? 'checkout'
      : 'routine';
  const cleanTypeLabel =
    cleanType === 'discharge'
      ? 'Discharge Clean'
      : cleanType === 'checkout'
      ? 'Checkout Clean'
      : 'Routine Clean';

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0d9488" />
          <Text style={styles.loadingText}>Loading checklist...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && steps.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => router.replace({ pathname: '/(housekeeper)/checklist', params })}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Room header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.roomHeaderContent}>
          <View style={styles.roomHeaderTop}>
            <Text style={styles.roomNumber}>Room {roomNumber}</Text>
            <Badge type={cleanTypeBadge} label={cleanTypeLabel} />
          </View>
          {patientName ? (
            <Text style={styles.patientName}>Patient: {patientName}</Text>
          ) : null}
          <Text style={styles.startTime}>
            Started {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>

          {/* Progress bar */}
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>
              {checkedCount} of {totalCount} steps
            </Text>
            <Text style={styles.progressLabel}>
              {Math.round(progress * 100)}%
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </View>
      </View>

      {/* Checklist */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChecklistItem step={item} onToggle={handleToggle} />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.zoneSectionHeader}>
            <Text style={styles.zoneSectionTitle}>{section.title.toUpperCase()}</Text>
          </View>
        )}
        ListFooterComponent={
          <View style={styles.photoSection}>
            <Text style={styles.photoSectionTitle}>Photo Verification</Text>
            <Text style={styles.photoSectionSubtitle}>
              Capture photos for compliance documentation
            </Text>
            <View style={styles.photoRow}>
              {Array.from({ length: PHOTO_SLOT_COUNT }, (_, i) => (
                <PhotoSlot
                  key={i}
                  uri={photoUris[i]}
                  required
                  label={`Room Photo ${i + 1}`}
                  onCapture={(uri) => handlePhotoCapture(i, uri)}
                />
              ))}
            </View>
            <View style={styles.bottomPadding} />
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled
      />

      {/* Submit button (fixed at bottom) */}
      <View style={styles.submitContainer}>
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit ? styles.submitButtonDisabled : null]}
          onPress={() => void handleSubmit()}
          disabled={isSubmitting}
          accessibilityLabel={
            canSubmit
              ? 'Submit room as clean'
              : 'Complete all steps and photos before submitting'
          }
          accessibilityRole="button"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>
              {canSubmit ? 'Submit Room as Clean' : `${checkedCount}/${totalCount} Steps · ${photoUris.filter(Boolean).length}/${PHOTO_SLOT_COUNT} Photos`}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Missing items modal */}
      <Modal
        visible={showMissingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMissingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Cannot Submit Yet</Text>
            <Text style={styles.modalSubtitle}>
              Complete the following before submitting:
            </Text>
            <FlatList
              data={missingItems}
              keyExtractor={(item, i) => `${i}-${item}`}
              renderItem={({ item }) => (
                <View style={styles.missingItem}>
                  <Text style={styles.missingDot}>•</Text>
                  <Text style={styles.missingText}>{item}</Text>
                </View>
              )}
            />
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowMissingModal(false)}
            >
              <Text style={styles.modalCloseText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: {
    paddingVertical: 4,
    marginBottom: 8,
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    color: '#0d9488',
    fontSize: 15,
    fontWeight: '600',
  },
  roomHeaderContent: {},
  roomHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  roomNumber: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  patientName: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 2,
  },
  startTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 8,
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
    backgroundColor: '#0d9488',
    borderRadius: 3,
  },
  zoneSectionHeader: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  zoneSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 0.5,
  },
  listContent: {
    paddingBottom: 100,
  },
  photoSection: {
    padding: 16,
    backgroundColor: '#ffffff',
    marginTop: 8,
  },
  photoSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  photoSectionSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  photoRow: {
    flexDirection: 'row',
    marginHorizontal: -5,
  },
  bottomPadding: {
    height: 24,
  },
  submitContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  submitButton: {
    backgroundColor: '#0d9488',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 54,
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  missingItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  missingDot: {
    color: '#dc2626',
    fontSize: 15,
    marginRight: 8,
    marginTop: 1,
  },
  missingText: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
  },
  modalClose: {
    backgroundColor: '#0d9488',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    minHeight: 50,
    justifyContent: 'center',
  },
  modalCloseText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});
