import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

interface ProgressBarProps {
  progress: number; // 0–1
  height?: number;
}

export function ProgressBar({ progress, height = 8 }: ProgressBarProps) {
  const { colors, radii } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: colors.border, height, borderRadius: radii.full }]}>
      <View
        style={[
          styles.fill,
          {
            backgroundColor: colors.indigo,
            width: `${Math.min(100, Math.max(0, progress * 100))}%`,
            height,
            borderRadius: radii.full,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0 },
});
