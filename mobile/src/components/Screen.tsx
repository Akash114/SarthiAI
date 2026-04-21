import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

interface ScreenProps {
  children: React.ReactNode;
  backgroundColor?: string;
}

export function Screen({ children, backgroundColor }: ScreenProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: backgroundColor ?? colors.background }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
