import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

interface PhotoSlotProps {
  uri?: string;
  required: boolean;
  onCapture: (uri: string) => void;
  label?: string;
}

export default function PhotoSlot({
  uri,
  required,
  onCapture,
  label = 'Photo',
}: PhotoSlotProps) {
  const handlePress = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Please allow camera access in your device settings to capture room photos.',
        [{ text: 'OK' }],
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      if (asset.uri) {
        onCapture(asset.uri);
      }
    }
  }, [onCapture]);

  return (
    <TouchableOpacity
      style={[styles.slot, uri ? styles.slotFilled : styles.slotEmpty]}
      onPress={() => void handlePress()}
      activeOpacity={0.7}
      accessibilityLabel={`${label}: ${uri ? 'Photo captured, tap to retake' : 'Tap to take photo'}${required ? ' (required)' : ''}`}
      accessibilityRole="button"
    >
      {uri ? (
        <Image source={{ uri }} style={styles.thumbnail} resizeMode="cover" />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.cameraIcon}>📷</Text>
          <Text style={styles.placeholderText}>{label}</Text>
          {required && (
            <View style={styles.requiredBadge}>
              <Text style={styles.requiredText}>Required</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
    marginHorizontal: 5,
  },
  slotEmpty: {
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotFilled: {
    borderWidth: 2,
    borderColor: '#10b981',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  cameraIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  placeholderText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  requiredBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredText: {
    color: '#dc2626',
    fontSize: 10,
    fontWeight: '600',
  },
});
