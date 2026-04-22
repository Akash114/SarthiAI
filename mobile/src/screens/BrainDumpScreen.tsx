import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useTheme } from '../theme';
import { Screen, AppHeader, Button } from '../components';
import { apiJson } from '../api/client';
import type { BrainDumpRequest, BrainDumpResponse } from '../api/types';

type BrainDumpNav = {
  navigate: (screen: string, params?: object) => void;
  goBack: () => void;
  getParent?: () =>
    | {
        getParent?: () => { navigate: (name: string, params?: object) => void };
      }
    | undefined;
};

export function BrainDumpScreen({ navigation, route }: { navigation: BrainDumpNav; route?: { params?: { isOnboarding?: boolean } } }) {
  const { colors, spacing } = useTheme();
  const isOnboarding = route?.params?.isOnboarding ?? false;
  const [text, setText] = useState('');
  const MAX = 2000;

  const mutation = useMutation({
    mutationFn: (json: BrainDumpRequest) =>
      apiJson<BrainDumpResponse>('/v1/brain-dump', { method: 'POST', json }),
    onSuccess: (data) => {
      if (isOnboarding) {
        navigation.navigate('PlanReview', { isOnboarding: true });
        return;
      }
      const sigPreview = JSON.stringify(data.signals, null, 2).slice(0, 1200);
      Alert.alert(
        data.actionable ? 'Reflection — actionable' : 'Reflection captured',
        sigPreview + (sigPreview.length >= 1200 ? '\n…' : ''),
        [
          { text: 'OK' },
          {
            text: 'History',
            onPress: () => {
              const tab = navigation.getParent?.()?.getParent?.();
              tab?.navigate('SettingsTab', { screen: 'BrainDumpHistory' });
            },
          },
        ],
      );
    },
  });

  return (
    <Screen>
      <AppHeader title="Brain Dump" onBack={() => navigation.goBack()} />
      <View style={[styles.root, { padding: spacing.lg }]}>
        <Text style={[{ color: colors.text, fontSize: 15, marginBottom: spacing.md }]}>
          What's on your mind? Capture everything — we'll extract what matters.
        </Text>
        <TextInput
          testID="braindump-input"
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          placeholder="Type everything you're thinking about..."
          placeholderTextColor={colors.textMuted}
          multiline
          value={text}
          onChangeText={setText}
          maxLength={MAX}
        />
        <Text style={[{ color: colors.textMuted, textAlign: 'right', fontSize: 12 }]}>
          {text.length}/{MAX}
        </Text>
        <Button
          title="Analyze Signal"
          onPress={() => {
            if (!text.trim()) return;
            mutation.mutate({ text });
          }}
          loading={mutation.isPending}
          style={{ marginTop: spacing.lg }}
          testID="braindump-submit-btn"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    textAlignVertical: 'top',
    minHeight: 200,
  },
});
