import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: 'sm' | 'md' | 'lg';
}

export function Card({ children, style, padding = 'md' }: CardProps) {
  const { colors, spacing, radii } = useTheme();
  const pad = { sm: spacing.sm, md: spacing.md, lg: spacing.lg }[padding];

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.card,
          borderRadius: radii.lg,
          padding: pad,
          borderWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
});
