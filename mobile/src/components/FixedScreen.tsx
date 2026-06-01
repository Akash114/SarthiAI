import React from 'react';
import { SafeAreaView, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';

interface FixedScreenProps {
  header?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  backgroundColor?: string;
  padded?: boolean;
  bodyStyle?: ViewStyle;
  testID?: string;
}

export function FixedScreen({
  header,
  children,
  footer,
  backgroundColor,
  padded = true,
  bodyStyle,
  testID,
}: FixedScreenProps) {
  const { colors, spacing } = useTheme();
  const { height } = useWindowDimensions();
  const compact = height < 760;

  return (
    <SafeAreaView testID={testID} style={[styles.root, { backgroundColor: backgroundColor ?? colors.background }]}>
      {header}
      <View
        style={[
          styles.body,
          padded && { padding: compact ? spacing.md : spacing.lg },
          bodyStyle,
        ]}
      >
        {children}
      </View>
      {footer ? <View style={[styles.footer, { padding: compact ? spacing.md : spacing.lg }]}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, overflow: 'hidden' },
  footer: { paddingTop: 0 },
});
