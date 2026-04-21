import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../theme';

interface ChipProps {
  label: string;
  variant?: 'default' | 'work' | 'personal' | 'needsFocus';
  style?: ViewStyle;
}

export function Chip({ label, variant = 'default', style }: ChipProps) {
  const { colors, spacing, radii } = useTheme();

  const variantStyles = {
    default: { bg: colors.indigoLight, text: colors.indigo },
    work: { bg: colors.chipWork, text: colors.chipWorkText },
    personal: { bg: colors.chipPersonal, text: colors.chipPersonalText },
    needsFocus: { bg: colors.chipNeedsFocus, text: colors.chipNeedsFocusText },
  };

  const v = variantStyles[variant];

  return (
    <View style={[styles.root, { backgroundColor: v.bg, borderRadius: radii.full, paddingHorizontal: spacing.sm }]}>
      <Text style={[styles.label, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'flex-start', paddingVertical: 4 },
  label: { fontSize: 12, fontWeight: '600' },
});
