import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTheme } from '../theme';
import { Screen, AppHeader, Card, ListRow, Button } from '../components';
import { usePreferences } from '../hooks/queries';
import { usePatchPreferences } from '../hooks/mutations';
import { useSessionStore } from '../state/sessionStore';
import { apiJson } from '../api/client';
import { ensureNotificationPermission } from '../lib/notifications';
import type { SettingsStackScreenProps } from '../navigation/types';

export function SettingsScreen({ navigation }: SettingsStackScreenProps<'Settings'>) {
  const { colors, spacing } = useTheme();
  const { data: prefs } = usePreferences();
  const patchPrefs = usePatchPreferences();
  const clearSession = useSessionStore((s) => s.clearSession);

  const toggle = (key: 'coaching_paused' | 'task_reminders_enabled' | 'interventions_enabled') => {
    patchPrefs.mutate({ [key]: !(prefs?.[key] ?? false) });
  };

  const handleLogout = async () => {
    try {
      await apiJson('/v1/auth/logout', { method: 'POST', json: { revoke_all: false } });
    } catch { /* ignore */ }
    await clearSession();
  };

  const handlePushPermission = async () => {
    const granted = await ensureNotificationPermission();
    if (!granted) Alert.alert('Permission denied', 'Enable notifications in your device settings.');
  };

  return (
    <Screen>
      <AppHeader title="Settings" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Card>
          <ListRow
            label="Pause Coaching"
            right={
              <Switch
                value={prefs?.coaching_paused ?? false}
                onValueChange={() => toggle('coaching_paused')}
                trackColor={{ true: colors.indigo }}
              />
            }
          />
          <ListRow
            label="Task Reminders"
            right={
              <Switch
                value={prefs?.task_reminders_enabled ?? true}
                onValueChange={() => toggle('task_reminders_enabled')}
                trackColor={{ true: colors.indigo }}
              />
            }
          />
          <ListRow
            label="Interventions"
            right={
              <Switch
                value={prefs?.interventions_enabled ?? true}
                onValueChange={() => toggle('interventions_enabled')}
                trackColor={{ true: colors.indigo }}
              />
            }
          />
        </Card>

        <Button
          title="Personalize Preferences"
          variant="ghost"
          onPress={() => navigation.push('PersonalizeSettings')}
          style={{ marginTop: spacing.lg }}
        />

        <Button
          title="Enable Notifications"
          variant="ghost"
          onPress={handlePushPermission}
          style={{ marginTop: spacing.sm }}
        />

        {__DEV__ && (
          <Button
            title="Dev: SliceScreen"
            variant="ghost"
            onPress={() => {
              // SliceScreen dev entry — intentionally a no-op in the main nav;
              // accessible via Settings in __DEV__ builds for manual testing.
              Alert.alert('Dev info', 'SliceScreen is at src/screens/dev/SliceScreen.tsx');
            }}
            style={{ marginTop: spacing.sm }}
          />
        )}

        <Button
          title="Log out"
          variant="destructive"
          onPress={handleLogout}
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </Screen>
  );
}
