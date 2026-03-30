import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ChecklistStep } from '../types';

interface ChecklistItemProps {
  step: ChecklistStep;
  onToggle: (id: string) => void;
}

export default function ChecklistItem({ step, onToggle }: ChecklistItemProps) {
  const handleToggle = useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onToggle(step.id);
  }, [step.id, onToggle]);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handleToggle}
      activeOpacity={0.7}
      accessibilityLabel={`${step.description}${step.checked ? ', checked' : ', unchecked'}${step.isHAIRisk ? ', HAI Risk step' : ''}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: step.checked }}
    >
      <View
        style={[
          styles.checkbox,
          step.checked ? styles.checkboxChecked : styles.checkboxUnchecked,
        ]}
      >
        {step.checked && <Text style={styles.checkmark}>✓</Text>}
      </View>

      <View style={styles.textContainer}>
        <Text
          style={[styles.description, step.checked ? styles.descriptionChecked : null]}
        >
          {step.description}
        </Text>
        {step.isHAIRisk && (
          <View style={styles.haiBadge}>
            <Text style={styles.haiText}>HAI Risk</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 12,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxUnchecked: {
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  checkboxChecked: {
    borderColor: '#10b981',
    backgroundColor: '#10b981',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  textContainer: {
    flex: 1,
  },
  description: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 22,
  },
  descriptionChecked: {
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  haiBadge: {
    backgroundColor: '#fee2e2',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  haiText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '600',
  },
});
