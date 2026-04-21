import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { Screen, AppHeader, Card, Button } from '../components';
import type { OnboardingScreenProps } from '../navigation/types';

export function PlanActivatedScreen({ navigation }: OnboardingScreenProps<'PlanActivated'>) {
  const { colors, spacing } = useTheme();

  return (
    <Screen>
      <AppHeader title="Plan Activated" onBack={() => navigation.goBack()} />
      <View style={[styles.root, { padding: spacing.lg }]}>
        <Card style={{ alignItems: 'center' }}>
          <Text style={[{ color: colors.success, fontWeight: '700', fontSize: 18 }]}>
            Plan Activated
          </Text>
          <Text style={[{ color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
            Your week-1 plan is now active. Check your home screen for today's tasks.
          </Text>
        </Card>
        <Button
          title="Back to Home"
          onPress={() => navigation.getParent()?.goBack()}
          style={{ marginTop: spacing.xl }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
});
