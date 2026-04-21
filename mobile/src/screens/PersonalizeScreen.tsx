import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { useTheme } from '../theme';
import { Screen, AppHeader, Card, Button } from '../components';
import { apiJson } from '../api/client';
import { useSessionStore } from '../state/sessionStore';
import { captureOnboardingCompleted } from '../lib/analytics';
import type { CoachingPreferencesPatchRequest, OnboardingPatchRequest } from '../api/types';

const schema = z.object({
  work_hours_start: z.string().optional(),
  work_hours_end: z.string().optional(),
  timezone: z.string().optional(),
});

type Form = z.infer<typeof schema>;

type PersonalizeNav = {
  navigation: { replace: (screen: string, params?: object) => void; goBack: () => void; push: (screen: string, params?: object) => void };
  route?: { params?: { isOnboarding?: boolean } };
};

export function PersonalizeScreen({ navigation, route }: PersonalizeNav) {
  const { colors, spacing } = useTheme();
  const isOnboarding = (route?.params as { isOnboarding?: boolean } | undefined)?.isOnboarding ?? false;
  const queryClient = useQueryClient();

  const { control, handleSubmit } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { work_hours_start: '09:00', work_hours_end: '17:00', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  });

  const patchPrefs = useMutation({
    mutationFn: (json: Partial<CoachingPreferencesPatchRequest>) =>
      apiJson('/v1/preferences', { method: 'PATCH', json }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['preferences'] }),
  });

  const patchOnboarding = useMutation({
    mutationFn: (json: Partial<OnboardingPatchRequest>) =>
      apiJson('/v1/onboarding', { method: 'PATCH', json }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      captureOnboardingCompleted();
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await patchPrefs.mutateAsync({
      work_hours_start: values.work_hours_start || undefined,
      work_hours_end: values.work_hours_end || undefined,
      timezone: values.timezone || undefined,
    });
    if (isOnboarding) {
      await patchOnboarding.mutateAsync({ mark_completed: true });
      navigation.replace('BrainDump', { isOnboarding: true });
    }
  });

  return (
    <Screen>
      <AppHeader title="Design Your Ideal Day" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={[styles.heading, { color: colors.text }]}>When do you work?</Text>

        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={[{ color: colors.textSecondary }]}>Start</Text>
            <Controller
              control={control}
              name="work_hours_start"
              render={({ field: { onChange, value } }) => (
                <Pressable style={[styles.input, { borderColor: colors.border }]} onPress={() => {}}>
                  <Text>{value ?? '09:00'}</Text>
                </Pressable>
              )}
            />
          </View>
          <View style={styles.field}>
            <Text style={[{ color: colors.textSecondary }]}>End</Text>
            <Controller
              control={control}
              name="work_hours_end"
              render={({ field: { onChange, value } }) => (
                <Pressable style={[styles.input, { borderColor: colors.border }]} onPress={() => {}}>
                  <Text>{value ?? '17:00'}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>

        <Button
          title={isOnboarding ? 'Continue' : 'Save'}
          onPress={onSubmit}
          loading={patchPrefs.isPending || patchOnboarding.isPending}
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12 },
  field: { flex: 1, gap: 4 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 4 },
});
