import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert } from 'react-native';
import { useTheme } from '../theme';
import { FixedScreen, AppHeader, Button } from '../components';
import { usePostBrainDump } from '../hooks/mutations';

type BrainDumpNav = {
  navigate: (screen: string, params?: object) => void;
  replace: (screen: string, params?: object) => void;
  goBack: () => void;
  getParent?: () =>
    | {
        getParent?: () => { navigate: (name: string, params?: object) => void };
      }
    | undefined;
};

export function BrainDumpScreen({
  navigation,
  route,
}: {
  navigation: BrainDumpNav;
  route?: { params?: { focusSessionId?: string; taskId?: string; goalId?: string; teamId?: string } };
}) {
  const { colors, spacing } = useTheme();
  const [text, setText] = useState('');
  const MAX = 20000;

  const mutation = usePostBrainDump(route?.params?.focusSessionId);

  const onSuccess = (data: { id: string }) => {
    Alert.alert('Brain dump captured', 'Sarthi is turning this into proposals.', [
      {
        text: 'Review',
        onPress: () => navigation.replace('BrainDumpReview', { dumpId: data.id }),
      },
      {
        text: 'Later',
        onPress: () => navigation.goBack(),
      },
    ]);
  };

  return (
    <FixedScreen
      header={<AppHeader title="Brain Dump" onBack={() => navigation.goBack()} />}
      footer={
        <Button
          title="Analyze"
          onPress={() => {
            if (!text.trim()) return;
            mutation.mutate(
              {
                text,
                focus_session_id: route?.params?.focusSessionId,
                task_id: route?.params?.taskId,
                goal_id: route?.params?.goalId,
                team_id: route?.params?.teamId,
              },
              { onSuccess },
            );
          }}
          loading={mutation.isPending}
          testID="braindump-submit-btn"
        />
      }
    >
      <View style={[styles.root, { padding: spacing.lg }]}>
        <Text style={[{ color: colors.text, fontSize: 15, marginBottom: spacing.md }]}>
          What is on your mind? Capture everything, then Sarthi will extract what matters.
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
      </View>
    </FixedScreen>
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
