import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  style,
  testID,
}: ButtonProps) {
  const { colors, spacing, radii } = useTheme();

  const sizeStyles = {
    sm: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
    md: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    lg: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  };

  const variantStyles: Record<string, { bg: string; text: string; border: string }> = {
    primary: { bg: colors.indigo, text: colors.white, border: 'transparent' },
    ghost: { bg: 'transparent', text: colors.indigo, border: colors.indigo },
    destructive: { bg: colors.error, text: colors.white, border: 'transparent' },
  };

  const v = variantStyles[variant];
  const sz = sizeStyles[size];

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.root,
        sz,
        { backgroundColor: v.bg, borderColor: v.border, borderWidth: variant === 'ghost' ? 1 : 0, borderRadius: radii.md, opacity: pressed ? 0.8 : disabled ? 0.4 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <Text style={[{ color: v.text, fontSize: 15, fontWeight: '600' }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
});
