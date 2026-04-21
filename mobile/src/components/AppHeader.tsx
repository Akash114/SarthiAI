import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

interface AppHeaderProps {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function AppHeader({ title, onBack, right }: AppHeaderProps) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={[styles.root, { borderBottomColor: colors.border, paddingHorizontal: spacing.md }]}>
      <View style={styles.left}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={8} testID="header-back-btn">
            <Text style={[styles.chevron, { color: colors.indigo }]}>{'‹'}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.center}>
        <Text style={[styles.title, { color: colors.text, ...typography.title }]}>{title}</Text>
      </View>
      <View style={styles.right}>{right ?? null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  left: { width: 40 },
  center: { flex: 1, alignItems: 'center' },
  right: { width: 40 },
  chevron: { fontSize: 28, fontWeight: '300' },
  title: { textAlign: 'center' },
});
