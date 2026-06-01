import React, { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTheme } from '../theme';
import { Button } from './Button';

interface DueDateFieldProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
}

export function DueDateField({ value, onChange }: DueDateFieldProps) {
  const { colors, spacing } = useTheme();
  const [open, setOpen] = useState(false);

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'dismissed') return;
    if (selected) onChange(selected);
  };

  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: spacing.xs }}>
        Due date, optional
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          padding: 12,
        }}
      >
        <Text style={{ color: value ? colors.text : colors.textMuted }}>
          {value ? value.toLocaleString() : 'Tap to pick date and time'}
        </Text>
      </Pressable>
      {value ? (
        <Button title="Clear due date" variant="ghost" onPress={() => onChange(null)} style={{ marginTop: spacing.xs }} />
      ) : null}
      {open ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode="datetime"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onPickerChange}
        />
      ) : null}
      {open && Platform.OS === 'ios' ? (
        <Button title="Done" variant="ghost" onPress={() => setOpen(false)} style={{ marginTop: spacing.xs }} />
      ) : null}
    </View>
  );
}
