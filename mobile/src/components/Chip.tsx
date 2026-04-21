import React from 'react';
import { View, Text, StyleSheet, ViewStyle, Pressable } from 'react-native';
import { useTheme } from '../theme';

interface ChipProps {
  label: string;
  variant?: 'default' | 'work' | 'personal' | 'needsFocus';
  style?: ViewStyle;
  /** When set, chip is pressable (e.g. filters, day pickers). */
  onPress?: () => void;
  selected?: boolean;
}

export function Chip({ label, variant = 'default', style, onPress, selected }: ChipProps) {
  const { colors, spacing, radii } = useTheme();

  const variantStyles = {
    default: { bg: colors.indigoLight, text: colors.indigo },
    work: { bg: colors.chipWork, text: colors.chipWorkText },
    personal: { bg: colors.chipPersonal, text: colors.chipPersonalText },
    needsFocus: { bg: colors.chipNeedsFocus, text: colors.chipNeedsFocusText },
  };

  const v = variantStyles[variant];
  const bg = selected ? colors.indigo : v.bg;
  const fg = selected ? colors.white : v.text;

  const inner = <Text style={[styles.label, { color: fg }]}>{label}</Text>;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.root,
          {
            backgroundColor: bg,
            borderRadius: radii.full,
            paddingHorizontal: spacing.sm,
            opacity: pressed ? 0.85 : 1,
            borderWidth: selected ? 0 : 1,
            borderColor: colors.border,
          },
          style,
        ]}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: v.bg, borderRadius: radii.full, paddingHorizontal: spacing.sm }, style]}>
      <Text style={[styles.label, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'flex-start', paddingVertical: 4 },
  label: { fontSize: 12, fontWeight: '600' },
});
