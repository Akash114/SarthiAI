import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { Button } from '../components';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Welcome'>;
};

export function WelcomeScreen({ navigation }: Props) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Text style={[typography.display, { color: colors.text }]}>Welcome to Sarthi</Text>
      <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md }]}>
        Your personal accountability companion.
      </Text>
      <Button
        title="Continue"
        onPress={() => navigation.navigate('Personalize', { isOnboarding: true })}
        style={{ marginTop: spacing.xl, width: '100%' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
});
