import React from 'react';
import { Alert, Text, View } from 'react-native';

import { Button, FixedScreen } from '../components';
import { isExpoGoAndroid } from '../lib/expoRuntime';
import { enablePushAndRegister } from '../lib/notifications';
import type { OnboardingScreenProps } from '../navigation/types';
import { useTheme } from '../theme';

export function OnboardingNotificationsScreen({
  navigation,
}: OnboardingScreenProps<'OnboardingNotifications'>) {
  const { colors, spacing, typography } = useTheme();

  const continueToBrainDump = async () => {
    navigation.replace('FirstGoal');
  };

  const onEnable = async () => {
    if (isExpoGoAndroid()) {
      Alert.alert(
        'Use a development build for push',
        'Expo Go on Android cannot register push tokens. Install a dev or preview APK to test notifications, or tap Not now to continue in Expo Go.',
      );
      return;
    }
    const result = await enablePushAndRegister();
    if (!result.granted) {
      Alert.alert('Permission denied', 'You can enable notifications later from Settings.');
      await continueToBrainDump();
      return;
    }
    await continueToBrainDump();
  };

  const onSkip = async () => {
    await continueToBrainDump();
  };

  return (
    <FixedScreen>
      <View style={{ flex: 1, justifyContent: 'center', padding: spacing.lg }}>
        <Text style={[typography.display, { color: colors.text }]}>Stay on track with reminders</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md }]}>
          Enable notifications so Sarthi can send task reminders and intervention prompts when you need them.
        </Text>
        {isExpoGoAndroid() ? (
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm, fontSize: 13 }]}>
            Expo Go on Android does not support push. Use a development or preview build to test notifications; you
            can skip this step here.
          </Text>
        ) : null}
        <Button testID="onboarding-notifications-enable" title="Enable notifications" onPress={onEnable} style={{ marginTop: spacing.xl }} />
        <Button testID="onboarding-notifications-skip" title="Not now" variant="ghost" onPress={onSkip} style={{ marginTop: spacing.sm }} />
      </View>
    </FixedScreen>
  );
}
