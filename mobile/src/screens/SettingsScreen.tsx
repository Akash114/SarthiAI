import React, { useEffect, useState } from 'react';
import { Alert, Switch, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { AppHeader, Button, Card, FixedScreen, ListRow, Modal } from '../components';
import { useMe, useNotificationsConfig, usePreferences } from '../hooks/queries';
import { usePatchPreferences, usePatchProfile } from '../hooks/mutations';
import { useSessionStore } from '../state/sessionStore';
import { apiJson } from '../api/client';
import { enablePushAndRegister, unregisterPushTokenFromBackend } from '../lib/notifications';
import type { SettingsStackScreenProps } from '../navigation/types';
import { useTheme } from '../theme';

export function SettingsScreen({ navigation }: SettingsStackScreenProps<'Settings'>) {
  const { colors, spacing } = useTheme();
  const { data: prefs } = usePreferences();
  const { data: notifCfg } = useNotificationsConfig();
  const { data: me } = useMe();
  const patchPrefs = usePatchPreferences();
  const patchProfile = usePatchProfile();
  const queryClient = useQueryClient();
  const clearSession = useSessionStore((s) => s.clearSession);
  const [profileOpen, setProfileOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    setDisplayName(me?.display_name ?? '');
  }, [me?.display_name]);

  const saveProfile = async () => {
    try {
      await patchProfile.mutateAsync({ display_name: displayName.trim() || null });
      setProfileOpen(false);
    } catch (e) {
      Alert.alert('Could not update profile', e instanceof Error ? e.message : 'Try again.');
    }
  };

  const toggle = (key: 'coaching_paused' | 'task_reminders_enabled' | 'interventions_enabled') => {
    patchPrefs.mutate({ [key]: !(prefs?.[key] ?? false) });
  };

  const handleLogout = async () => {
    await unregisterPushTokenFromBackend();
    try {
      await apiJson('/v1/auth/logout', { method: 'POST', json: { revoke_all: false } });
    } catch {
      /* ignore logout network errors */
    }
    queryClient.clear();
    await clearSession();
  };

  const handlePushPermission = async () => {
    if (notifCfg && !notifCfg.enabled) {
      Alert.alert('Server push disabled', `Provider: ${notifCfg.provider}. Tokens can still be saved for later.`);
    }
    const result = await enablePushAndRegister();
    Alert.alert(result.granted ? 'Notifications updated' : 'Permission denied');
  };

  return (
    <FixedScreen
      header={<AppHeader title="Settings" />}
      footer={<Button title="Log out" variant="destructive" onPress={handleLogout} />}
    >
      {notifCfg && !notifCfg.enabled ? (
        <Card style={{ marginBottom: spacing.md, borderColor: colors.warning, borderWidth: 1 }}>
          <Text style={{ color: colors.warning, fontWeight: '600' }}>Server push disabled</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>Provider: {notifCfg.provider}</Text>
        </Card>
      ) : null}

      <Card>
        <ListRow
          label="Pause coaching"
          right={<Switch value={prefs?.coaching_paused ?? false} onValueChange={() => toggle('coaching_paused')} trackColor={{ true: colors.indigo }} />}
        />
        <ListRow
          label="Task reminders"
          right={<Switch value={prefs?.task_reminders_enabled ?? true} onValueChange={() => toggle('task_reminders_enabled')} trackColor={{ true: colors.indigo }} />}
        />
        <ListRow
          label="Interventions"
          right={<Switch value={prefs?.interventions_enabled ?? true} onValueChange={() => toggle('interventions_enabled')} trackColor={{ true: colors.indigo }} />}
        />
      </Card>

      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <Button title="Edit profile" variant="ghost" onPress={() => setProfileOpen(true)} />
        <Button title="Personalize" variant="ghost" onPress={() => navigation.push('PersonalizeSettings')} />
        <Button title="Focus history" variant="ghost" onPress={() => navigation.push('FocusHistory')} />
        <Button title="Brain dump history" variant="ghost" onPress={() => navigation.push('BrainDumpHistory')} />
        <Button title="Enable notifications" variant="ghost" onPress={handlePushPermission} />
      </View>

      <Modal visible={profileOpen} onDismiss={() => setProfileOpen(false)} title="Profile">
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>Display name</Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={me?.email?.split('@')[0] ?? 'Your name'}
          placeholderTextColor={colors.textMuted}
          style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text }}
        />
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: spacing.sm }}>{me?.email}</Text>
        <Button title="Save" onPress={saveProfile} loading={patchProfile.isPending} style={{ marginTop: spacing.md }} />
      </Modal>

      <Card style={{ marginTop: spacing.lg, backgroundColor: colors.indigoLight }}>
        <Text style={{ color: colors.indigoDark, fontWeight: '700' }}>Account policy</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 6 }}>
          Sarthi does not support account deletion or anonymous account merging.
        </Text>
      </Card>
    </FixedScreen>
  );
}
