import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { useTheme } from '../theme';
import { FixedScreen, AppHeader, Card, Button, Chip } from '../components';
import { usePreferences } from '../hooks/queries';
import { usePatchPreferences } from '../hooks/mutations';

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

type PersonalizeNav = {
  navigation: { replace: (screen: string, params?: object) => void; goBack: () => void; push: (screen: string, params?: object) => void };
  route?: { params?: { isOnboarding?: boolean } };
};

export function PersonalizeScreen({ navigation, route }: PersonalizeNav) {
  const { colors, spacing } = useTheme();
  const isOnboarding = (route?.params as { isOnboarding?: boolean } | undefined)?.isOnboarding ?? false;
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

  const patchPrefs = usePatchPreferences();

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
      navigation.replace('OnboardingNotifications');
    } else {
      navigation.goBack();
    }
  };

  return (
    <FixedScreen
      header={<AppHeader title="Design Your Day" onBack={!isOnboarding ? () => navigation.goBack() : undefined} />}
      footer={
        <Button
          testID={isOnboarding ? 'onboarding-personalize-continue' : undefined}
          title={isOnboarding ? 'Continue' : 'Save'}
          onPress={onSave}
          loading={patchPrefs.isPending}
        />
      }
    >
      <Text style={[styles.heading, { color: colors.text }]}>When do you work?</Text>

      <Card style={{ marginTop: spacing.md }}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Work hours</Text>
        <View style={[styles.row, { gap: spacing.sm }]}>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            value={workStart}
            onChangeText={setWorkStart}
            placeholder="09:00"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            value={workEnd}
            onChangeText={setWorkEnd}
            placeholder="17:00"
            placeholderTextColor={colors.textMuted}
          />
        </View>
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
        <SlotRow label="Fitness" value={fitnessTime} onChange={setFitnessTime} />
        <SlotRow label="Hobby" value={hobbyTime} onChange={setHobbyTime} />
        <SlotRow label="Admin" value={adminTime} onChange={setAdminTime} />
      </Card>
    </FixedScreen>
  );
}

function SlotRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: (typeof TIME_SLOTS)[number];
  onChange: (v: (typeof TIME_SLOTS)[number]) => void;
}) {
  const { colors, spacing } = useTheme();
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
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12 },
});
