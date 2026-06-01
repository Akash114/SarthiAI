import React, { useEffect } from 'react';
import { captureOnboardingStarted } from '../lib/analytics';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { Button, FixedScreen } from '../components';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Welcome'>;
};

export function WelcomeScreen({ navigation }: Props) {
  const { colors, spacing, typography } = useTheme();

  useEffect(() => {
    captureOnboardingStarted('post_registration');
  }, []);

  return (
    <FixedScreen backgroundColor={colors.background}>
      <View style={styles.root}>
      <Text style={[typography.display, { color: colors.text }]}>Welcome to Sarthi</Text>
      <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md }]}>
        Your personal accountability companion.
      </Text>
      <Button
        testID="onboarding-welcome-continue"
        title="Continue"
        onPress={() => navigation.navigate('Personalize', { isOnboarding: true })}
        style={{ marginTop: spacing.xl, width: '100%' }}
      />
    </View>
    </FixedScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
