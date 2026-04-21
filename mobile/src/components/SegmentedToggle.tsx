import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

interface SegmentedToggleProps {
  options: string[];
  selected: number;
  onChange: (index: number) => void;
}

export function SegmentedToggle({ options, selected, onChange }: SegmentedToggleProps) {
  const { colors, spacing, radii } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.card, borderRadius: radii.full, padding: 2 }]}>
      {options.map((opt, i) => (
        <Pressable
          key={opt}
          onPress={() => onChange(i)}
          style={[
            styles.segment,
            {
              backgroundColor: selected === i ? colors.white : 'transparent',
              borderRadius: radii.full,
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.md,
            },
          ]}
        >
          <Text
            style={[
              styles.label,
              { color: selected === i ? colors.indigo : colors.textSecondary },
            ]}
          >
            {opt}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row' },
  segment: { flex: 1, alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '600' },
});
