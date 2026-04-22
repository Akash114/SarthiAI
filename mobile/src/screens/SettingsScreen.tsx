import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert, TextInput } from 'react-native';
import { useTheme } from '../theme';
import { Screen, AppHeader, Card, ListRow, Button } from '../components';
import { usePreferences, useNotificationsConfig } from '../hooks/queries';
import { usePatchPreferences, useMergeAnonymous } from '../hooks/mutations';
import { useSessionStore } from '../state/sessionStore';
import { apiJson } from '../api/client';
import { ensureNotificationPermission, unregisterPushTokenFromBackend } from '../lib/notifications';
import type { SettingsStackScreenProps } from '../navigation/types';

export function SettingsScreen({ navigation }: SettingsStackScreenProps<'Settings'>) {
  const { colors, spacing } = useTheme();
  const { data: prefs } = usePreferences();
  const { data: notifCfg } = useNotificationsConfig();
  const patchPrefs = usePatchPreferences();
  const mergeAnonymous = useMergeAnonymous();
  const clearSession = useSessionStore((s) => s.clearSession);
  const [anonymousId, setAnonymousId] = useState('');

  const toggle = (key: 'coaching_paused' | 'task_reminders_enabled' | 'interventions_enabled') => {
    patchPrefs.mutate({ [key]: !(prefs?.[key] ?? false) });
  };

  const handleLogout = async () => {
    await unregisterPushTokenFromBackend();
    try {
      await apiJson('/v1/auth/logout', { method: 'POST', json: { revoke_all: false } });
    } catch {
      /* ignore */
    }
    await clearSession();
  };

  const handlePushPermission = async () => {
    if (notifCfg && !notifCfg.enabled) {
      Alert.alert(
        'Server notifications off',
        'This environment has push delivery disabled on the server. You can still enable OS permission locally.',
      );
    }
    const granted = await ensureNotificationPermission();
    if (!granted) Alert.alert('Permission denied', 'Enable notifications in your device settings.');
  };

  const onMerge = () => {
    const raw = anonymousId.trim();
    if (!raw) {
      Alert.alert('Anonymous user ID', 'Paste the UUID of the anonymous account to merge.');
      return;
    }
    mergeAnonymous.mutate(raw, {
      onSuccess: (res) => {
        Alert.alert(res.merged ? 'Merged' : 'Not merged', res.message);
        if (res.merged) setAnonymousId('');
      },
      onError: (e) => Alert.alert('Merge failed', e instanceof Error ? e.message : 'Unknown error'),
    });
  };

  return (
    <Screen>
      <AppHeader title="Settings" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {notifCfg && !notifCfg.enabled ? (
          <Card style={{ marginBottom: spacing.md, borderColor: colors.warning, borderWidth: 1 }}>
            <Text style={[{ color: colors.warning, fontWeight: '600' }]}>Server push disabled</Text>
            <Text style={[{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }]}>
              Provider: {notifCfg.provider}. Tokens may still be stored for when notifications are enabled.
            </Text>
          </Card>
        ) : null}

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
          title="Past reflections"
          variant="ghost"
          onPress={() => navigation.push('BrainDumpHistory')}
          style={{ marginTop: spacing.sm }}
        />

        <Button
          title="Focus session history"
          variant="ghost"
          onPress={() => navigation.push('FocusHistory')}
          style={{ marginTop: spacing.sm }}
        />

        <Button
          title="Enable Notifications"
          variant="ghost"
          onPress={handlePushPermission}
          style={{ marginTop: spacing.sm }}
        />

        <Card style={{ marginTop: spacing.lg }}>
          <Text style={[{ color: colors.textSecondary, fontSize: 13, marginBottom: spacing.sm }]}>
            Link anonymous account
          </Text>
          <Text style={[{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm }]}>
            If you have an anonymous user UUID from a prior install, merge its data into this account.
          </Text>
          <TextInput
            value={anonymousId}
            onChangeText={setAnonymousId}
            placeholder="Anonymous user UUID"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            style={[
              styles.input,
              { borderColor: colors.border, color: colors.text, marginBottom: spacing.sm },
            ]}
          />
          <Button title="Merge anonymous data" onPress={onMerge} loading={mergeAnonymous.isPending} />
        </Card>

        {__DEV__ && (
          <Button
            title="Dev: SliceScreen"
            variant="ghost"
            onPress={() => {
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

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
});
