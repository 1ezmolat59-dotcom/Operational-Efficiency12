import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

type BadgeType =
  | 'discharge'
  | 'checkout'
  | 'routine'
  | 'in_progress'
  | 'urgent'
  | 'stat'
  | 'radiology'
  | 'complete'
  | 'on_shift'
  | 'hai_risk'
  | 'wheelchair'
  | 'stretcher'
  | 'none'
  | string;

interface BadgeProps {
  type: BadgeType;
  label: string;
  size?: 'sm' | 'md';
}

const colorMap: Record<string, { bg: string; text: string }> = {
  discharge: { bg: '#fee2e2', text: '#dc2626' },
  checkout: { bg: '#ccfbf1', text: '#0d9488' },
  routine: { bg: '#f3f4f6', text: '#6b7280' },
  in_progress: { bg: '#dbeafe', text: '#1d4ed8' },
  urgent: { bg: '#fee2e2', text: '#dc2626' },
  stat: { bg: '#fee2e2', text: '#dc2626' },
  radiology: { bg: '#ede9fe', text: '#7c3aed' },
  complete: { bg: '#d1fae5', text: '#065f46' },
  on_shift: { bg: '#d1fae5', text: '#065f46' },
  hai_risk: { bg: '#fee2e2', text: '#dc2626' },
  wheelchair: { bg: '#e0f2fe', text: '#0369a1' },
  stretcher: { bg: '#fef3c7', text: '#92400e' },
  none: { bg: '#f3f4f6', text: '#6b7280' },
  default: { bg: '#f3f4f6', text: '#6b7280' },
};

export default function Badge({ type, label, size = 'md' }: BadgeProps) {
  const colors = colorMap[type] ?? colorMap['default'];

  const containerStyle: ViewStyle = {
    backgroundColor: colors.bg,
    paddingHorizontal: size === 'sm' ? 6 : 10,
    paddingVertical: size === 'sm' ? 2 : 4,
    borderRadius: 100,
    alignSelf: 'flex-start',
  };

  const textStyle: TextStyle = {
    color: colors.text,
    fontSize: size === 'sm' ? 11 : 12,
    fontWeight: '600',
  };

  return (
    <View style={containerStyle}>
      <Text style={textStyle}>{label}</Text>
    </View>
  );
}

// Keep styles for re-use if needed
const _styles = StyleSheet.create({
  unused: {},
});
