import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, FixedScreen } from '../../components';
import { useTeams } from '../../hooks/queries';
import type { TeamStackScreenProps } from '../../navigation/types';
import { useTheme } from '../../theme';

export function TeamListScreen({ navigation }: TeamStackScreenProps<'TeamList'>) {
  const { colors, spacing, typography } = useTheme();
  const { data, isPending } = useTeams();
  const teams = data?.teams ?? [];

  return (
    <FixedScreen
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button title="Create" onPress={() => navigation.navigate('TeamCreate')} style={{ flex: 1 }} />
          <Button title="Join" variant="ghost" onPress={() => navigation.navigate('TeamJoin')} style={{ flex: 1 }} />
        </View>
      }
    >
      <Text style={[typography.display, { color: colors.text }]}>Teams</Text>
      <Text style={{ color: colors.textSecondary, marginTop: spacing.xs }}>Shared goals and tasks with your people.</Text>
      <View style={{ flex: 1, gap: spacing.sm, marginTop: spacing.lg }}>
        {isPending ? <Text style={{ color: colors.textMuted }}>Loading teams...</Text> : null}
        {!isPending && teams.length === 0 ? <Text style={{ color: colors.textMuted }}>No teams yet.</Text> : null}
        {teams.slice(0, 4).map((team) => (
          <Pressable key={team.id} onPress={() => navigation.navigate('TeamBoard', { teamId: team.id })}>
            <Card>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{team.name}</Text>
              <Text style={{ color: colors.textSecondary, marginTop: spacing.xs }}>
                {team.member_count} members · {team.role}
              </Text>
            </Card>
          </Pressable>
        ))}
      </View>
    </FixedScreen>
  );
}
