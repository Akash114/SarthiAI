import React, { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import { AppHeader, Button, FixedScreen } from '../../components';
import { useCreateTeam } from '../../hooks/mutations';
import type { TeamStackScreenProps } from '../../navigation/types';
import { useTheme } from '../../theme';

export function TeamCreateScreen({ navigation }: TeamStackScreenProps<'TeamCreate'>) {
  const { colors, spacing } = useTheme();
  const [name, setName] = useState('');
  const create = useCreateTeam();

  const onCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const res = await create.mutateAsync({ name: trimmed });
      Alert.alert('Invite code', `Share this code with your teammates: ${res.invite_code}`, [
        {
          text: 'Open board',
          onPress: () => navigation.replace('TeamBoard', { teamId: res.team.id }),
        },
      ]);
    } catch (e) {
      Alert.alert('Could not create team', e instanceof Error ? e.message : 'Try again.');
    }
  };

  return (
    <FixedScreen header={<AppHeader title="Create Team" onBack={() => navigation.goBack()} />}>
      <View style={{ padding: spacing.lg }}>
        <Text style={{ color: colors.textSecondary, marginBottom: spacing.sm }}>Team name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Engineering"
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
        <Button title="Create team" onPress={onCreate} loading={create.isPending} style={{ marginTop: spacing.md }} />
      </View>
    </FixedScreen>
  );
}
