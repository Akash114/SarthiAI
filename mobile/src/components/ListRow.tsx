import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

interface ListRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
}

export function ListRow({ label, value, onPress, right }: ListRowProps) {
  const { colors } = useTheme();
  const Wrapper = onPress ? Pressable : View;

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
