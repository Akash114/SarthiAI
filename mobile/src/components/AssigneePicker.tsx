import React from 'react';
import { Text, View } from 'react-native';
import type { TeamMember } from '../api/types';
import { useTheme } from '../theme';
import { Chip } from './Chip';

interface AssigneePickerProps {
  members: TeamMember[];
  value: string | null;
  onChange: (userId: string | null) => void;
}

function memberLabel(member: TeamMember) {
  return member.display_name?.trim() || member.email.split('@')[0];
}

export function AssigneePicker({ members, value, onChange }: AssigneePickerProps) {
  const { colors, spacing } = useTheme();
  const visible = members.slice(0, 6);

  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: spacing.xs }}>
        Assignee
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        <Chip label="Unassigned" selected={value === null} onPress={() => onChange(null)} />
        {visible.map((member) => (
          <Chip
            key={member.user_id}
            label={memberLabel(member)}
            selected={value === member.user_id}
            onPress={() => onChange(member.user_id)}
          />
        ))}
      </View>
      {members.length > visible.length ? (
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: spacing.xs }}>
          Showing {visible.length} of {members.length} members.
        </Text>
      ) : null}
    </View>
  );
}
