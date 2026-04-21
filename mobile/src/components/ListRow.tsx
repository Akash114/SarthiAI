import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

interface ListRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
}

export function ListRow({ label, value, onPress, right }: ListRowProps) {
  const { colors, spacing } = useTheme();
  const Wrapper = onPress ? require('react-native').Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      style={[styles.root, { borderBottomColor: colors.border }]}
    >
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={styles.right}>
        {value != null ? <Text style={[{ color: colors.textSecondary }]}>{value}</Text> : null}
        {right ?? null}
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  label: { flex: 1, fontSize: 15 },
  right: { flexDirection: 'row', alignItems: 'center' },
});
