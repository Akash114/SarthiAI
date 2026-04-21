import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../theme';
import { Screen, AppHeader, Card, Button, Chip } from '../components';
import { apiJson } from '../api/client';
import { captureOnboardingCompleted } from '../lib/analytics';
import type { CoachingPreferencesPatchRequest, OnboardingPatchRequest } from '../api/types';
import type { Colors, Spacing } from '../theme/tokens';
import { usePreferences } from '../hooks/queries';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
/** UI index 0 = Monday → API ISO weekday 1 … Sunday → 7 */
function uiIndexToIsoWeekday(i: number): number {
  return i + 1;
}
const TIME_SLOTS = ['Morning', 'Afternoon', 'Evening'] as const;
type TimeSlot = (typeof TIME_SLOTS)[number];

function slotKeyToApi(k: TimeSlot): 'morning' | 'afternoon' | 'evening' {
  return k.toLowerCase() as 'morning' | 'afternoon' | 'evening';
}

const HALF_HOUR_OPTS: string[] = (() => {
  const out: string[] = [];
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 30]) {
      if (h === 22 && m > 0) break;
      out.push(`${String(h).padStart(2, '0')}:${m === 0 ? '00' : '30'}`);
    }
  }
  return out;
})();

type PersonalizeNav = {
  navigation: { replace: (screen: string, params?: object) => void; goBack: () => void; push: (screen: string, params?: object) => void };
  route?: { params?: { isOnboarding?: boolean } };
};

export function PersonalizeScreen({ navigation, route }: PersonalizeNav) {
  const { colors, spacing } = useTheme();
  const isOnboarding = (route?.params as { isOnboarding?: boolean } | undefined)?.isOnboarding ?? false;
  const queryClient = useQueryClient();

  const { data: prefs } = usePreferences();

  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('17:00');
  const [workDays, setWorkDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [fitnessTime, setFitnessTime] = useState<TimeSlot>('Morning');
  const [hobbyTime, setHobbyTime] = useState<TimeSlot>('Evening');
  const [adminTime, setAdminTime] = useState<TimeSlot>('Afternoon');

  useEffect(() => {
    if (!prefs) return;
    if (prefs.work_hours_start) setWorkStart(prefs.work_hours_start);
    if (prefs.work_hours_end) setWorkEnd(prefs.work_hours_end);
    if (prefs.work_days?.length) {
      setWorkDays([...prefs.work_days].sort((a, b) => a - b));
    }
    const slots = prefs.personal_slots ?? {};
    const rev = (k: string) => {
      const v = slots[k];
      if (v === 'morning') return 'Morning';
      if (v === 'afternoon') return 'Afternoon';
      if (v === 'evening') return 'Evening';
      return 'Morning';
    };
    setFitnessTime(rev('fitness') as TimeSlot);
    setHobbyTime(rev('hobby') as TimeSlot);
    setAdminTime(rev('admin') as TimeSlot);
  }, [prefs]);

  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const patchPrefs = useMutation({
    mutationFn: (json: Partial<CoachingPreferencesPatchRequest>) =>
      apiJson('/v1/preferences', { method: 'PATCH', json }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['preferences'] }),
  });

  const patchOnboarding = useMutation({
    mutationFn: (json: Partial<OnboardingPatchRequest>) => apiJson('/v1/onboarding', { method: 'PATCH', json }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      captureOnboardingCompleted();
    },
  });

  const toggleDay = (uiIndex: number) => {
    const d = uiIndexToIsoWeekday(uiIndex);
    setWorkDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)));
  };

  const onSave = async () => {
    await patchPrefs.mutateAsync({
      work_hours_start: workStart,
      work_hours_end: workEnd,
      work_days: workDays,
      personal_slots: {
        fitness: slotKeyToApi(fitnessTime),
        hobby: slotKeyToApi(hobbyTime),
        admin: slotKeyToApi(adminTime),
      },
      timezone: tz,
    });
    if (isOnboarding) {
      await patchOnboarding.mutateAsync({ mark_completed: true });
      navigation.replace('BrainDump', { isOnboarding: true });
    } else {
      navigation.goBack();
    }
  };

  const timeChip = (label: string, selected: boolean, onPress: () => void) => (
    <Chip key={label} label={label} variant="default" selected={selected} onPress={onPress} style={{ marginRight: spacing.xs, marginBottom: spacing.xs }} />
  );

  return (
    <Screen>
      <AppHeader title="Design Your Ideal Day" onBack={!isOnboarding ? () => navigation.goBack() : undefined} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text style={[styles.heading, { color: colors.text }]}>When do you work?</Text>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Work hours</Text>
          <Text style={[styles.muted, { color: colors.textSecondary, marginBottom: spacing.sm }]}>Start and end (local time)</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Start</Text>
          <View style={styles.wrapRow}>{HALF_HOUR_OPTS.map((t) => timeChip(t, workStart === t, () => setWorkStart(t)))}</View>
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: spacing.md }]}>End</Text>
          <View style={styles.wrapRow}>{HALF_HOUR_OPTS.map((t) => timeChip(t, workEnd === t, () => setWorkEnd(t)))}</View>
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Work days</Text>
          <View style={styles.wrapRow}>
            {DAY_LABELS.map((day, i) => (
              <Chip
                key={day}
                label={day}
                variant="default"
                selected={workDays.includes(uiIndexToIsoWeekday(i))}
                onPress={() => toggleDay(i)}
                style={{ marginRight: spacing.xs, marginBottom: spacing.xs }}
              />
            ))}
          </View>
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Personal time</Text>
          <SlotRow label="Fitness" value={fitnessTime} onChange={setFitnessTime} colors={colors} spacing={spacing} />
          <SlotRow label="Hobby" value={hobbyTime} onChange={setHobbyTime} colors={colors} spacing={spacing} />
          <SlotRow label="Admin / chores" value={adminTime} onChange={setAdminTime} colors={colors} spacing={spacing} />
        </Card>

        <Button
          title={isOnboarding ? 'Continue' : 'Save'}
          onPress={onSave}
          loading={patchPrefs.isPending || patchOnboarding.isPending}
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </Screen>
  );
}

function SlotRow({
  label,
  value,
  onChange,
  colors,
  spacing,
}: {
  label: string;
  value: (typeof TIME_SLOTS)[number];
  onChange: (v: (typeof TIME_SLOTS)[number]) => void;
  colors: Colors;
  spacing: Spacing;
}) {
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={{ color: colors.textSecondary, marginBottom: spacing.xs }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {TIME_SLOTS.map((slot) => (
          <Chip key={slot} label={slot} variant="default" selected={value === slot} onPress={() => onChange(slot)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  muted: { fontSize: 13 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
});
