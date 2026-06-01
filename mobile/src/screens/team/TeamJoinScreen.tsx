import React, { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import { AppHeader, Button, FixedScreen } from '../../components';
import { useJoinTeam } from '../../hooks/mutations';
import type { TeamStackScreenProps } from '../../navigation/types';
import { useTheme } from '../../theme';

export function TeamJoinScreen({ navigation }: TeamStackScreenProps<'TeamJoin'>) {
  const { colors, spacing } = useTheme();
  const [inviteCode, setInviteCode] = useState('');
  const join = useJoinTeam();

  const onJoin = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) return;
    try {
      const res = await join.mutateAsync({ invite_code: code });
      navigation.replace('TeamBoard', { teamId: res.team.id });
    } catch (e) {
      Alert.alert('Could not join team', e instanceof Error ? e.message : 'Try again.');
    }
  };

  return (
    <FixedScreen header={<AppHeader title="Join Team" onBack={() => navigation.goBack()} />}>
      <View style={{ padding: spacing.lg }}>
        <Text style={{ color: colors.textSecondary, marginBottom: spacing.sm }}>Invite code</Text>
        <TextInput
          value={inviteCode}
          onChangeText={setInviteCode}
          placeholder="AB12CD34"
          autoCapitalize="characters"
          placeholderTextColor={colors.textMuted}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: colors.text,
          }}
        />
        <Button title="Join team" onPress={onJoin} loading={join.isPending} style={{ marginTop: spacing.md }} />
      </View>
    </FixedScreen>
  );
}
