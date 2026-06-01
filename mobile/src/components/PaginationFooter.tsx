import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { useTheme } from '../theme';

interface PaginationFooterProps {
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export function PaginationFooter({ page, hasPrevious, hasNext, onPrevious, onNext }: PaginationFooterProps) {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.root, { gap: spacing.sm }]}>
      <Button title="Previous" variant="ghost" size="sm" disabled={!hasPrevious} onPress={onPrevious} style={styles.button} />
      <Text style={[styles.page, { color: colors.textMuted }]}>Page {page}</Text>
      <Button title="Next" variant="ghost" size="sm" disabled={!hasNext} onPress={onNext} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  button: { flex: 1 },
  page: { fontSize: 12, fontWeight: '600', minWidth: 64, textAlign: 'center' },
});
