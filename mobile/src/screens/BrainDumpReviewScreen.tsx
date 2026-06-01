import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, Card, FixedScreen, PaginationFooter } from '../components';
import { useApplyBrainDump } from '../hooks/mutations';
import { useBrainDumpDetail } from '../hooks/queries';
import type { BrainDumpProposal } from '../api/types';
import type { HomeStackScreenProps, SettingsStackScreenProps } from '../navigation/types';
import { useTheme } from '../theme';

type Props = HomeStackScreenProps<'BrainDumpReview'> | SettingsStackScreenProps<'BrainDumpReview'>;
const PAGE_SIZE = 3;

function proposalTitle(proposal: BrainDumpProposal) {
  const title = proposal.payload.title;
  if (typeof title === 'string' && title.trim()) return title;
  return proposal.change_type.replace(/_/g, ' ');
}

export function BrainDumpReviewScreen({ navigation, route }: Props) {
  const { colors, spacing } = useTheme();
  const dumpId = route.params.dumpId;
  const { data } = useBrainDumpDetail(dumpId, true);
  const applyMutation = useApplyBrainDump(dumpId);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(0);

  const proposals = data?.proposals ?? [];
  const pendingProposals = proposals.filter((proposal) => proposal.status === 'pending');
  const visible = pendingProposals.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const selectedIds = useMemo(
    () => pendingProposals.filter((proposal) => selected[proposal.id] !== false).map((proposal) => proposal.id),
    [pendingProposals, selected],
  );
  const hasNext = (page + 1) * PAGE_SIZE < pendingProposals.length;

  const toggle = (id: string) => setSelected((prev) => ({ ...prev, [id]: prev[id] === false }));

  const apply = async () => {
    if (selectedIds.length === 0) {
      Alert.alert('Nothing selected', 'Choose at least one proposal to apply.');
      return;
    }
    try {
      const result = await applyMutation.mutateAsync({ proposal_ids: selectedIds });
      Alert.alert(
        'Plan updated',
        `${result.created_task_ids.length + result.updated_task_ids.length} task changes and ${
          result.created_goal_ids.length + result.updated_goal_ids.length
        } goal changes applied.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      Alert.alert('Could not apply proposals', e instanceof Error ? e.message : 'Try again.');
    }
  };

  return (
    <FixedScreen
      header={<AppHeader title="Review Brain Dump" onBack={() => navigation.goBack()} />}
      footer={
        <View style={{ gap: spacing.sm }}>
          {pendingProposals.length > PAGE_SIZE ? (
            <PaginationFooter
              page={page + 1}
              hasPrevious={page > 0}
              hasNext={hasNext}
              onPrevious={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => (hasNext ? p + 1 : p))}
            />
          ) : null}
          <Button
            title="Apply selected"
            onPress={apply}
            loading={applyMutation.isPending}
            disabled={data?.processing_status !== 'processed'}
          />
        </View>
      }
    >
      <Card style={{ marginBottom: spacing.md }}>
        <Text style={[styles.label, { color: colors.textMuted }]}>STATUS</Text>
        <Text style={{ color: colors.text, marginTop: 4 }}>
          {data?.processing_status === 'pending'
            ? 'Processing your context...'
            : data?.processing_status === 'failed'
              ? 'Processing failed. Try another brain dump or check again later.'
              : data?.ai_result?.acknowledgement || 'Choose what Sarthi should change.'}
        </Text>
      </Card>

      <View style={{ flex: 1, gap: spacing.sm }}>
        {visible.map((proposal) => {
          const checked = selected[proposal.id] !== false;
          return (
            <Pressable key={proposal.id} onPress={() => toggle(proposal.id)} style={({ pressed }) => pressed && styles.pressed}>
              <Card padding="sm" style={{ borderColor: checked ? colors.indigo : colors.border }}>
                <View style={styles.proposalHeader}>
                  <Text numberOfLines={1} style={[styles.proposalTitle, { color: colors.text }]}>
                    {proposalTitle(proposal)}
                  </Text>
                  <Text style={{ color: checked ? colors.indigo : colors.textMuted }}>{checked ? 'Selected' : 'Off'}</Text>
                </View>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {proposal.change_type.replace(/_/g, ' ')} {proposal.confidence ? `· ${Math.round(proposal.confidence * 100)}%` : ''}
                </Text>
                {proposal.rationale ? (
                  <Text numberOfLines={2} style={{ color: colors.textSecondary, marginTop: 6 }}>
                    {proposal.rationale}
                  </Text>
                ) : null}
              </Card>
            </Pressable>
          );
        })}
        {data?.processing_status === 'processed' && pendingProposals.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No pending proposals in this brain dump.</Text>
        ) : null}
      </View>
    </FixedScreen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  proposalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  proposalTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 3 },
  pressed: { opacity: 0.82 },
});
