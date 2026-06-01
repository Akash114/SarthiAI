import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppHeader, Button, Card, FixedScreen } from '../components';
import { useResolveIntervention } from '../hooks/mutations';
import { useInterventions, useNotifications, useTransparency } from '../hooks/queries';
import { companionNotificationToRouteData } from '../lib/notificationNavigation';
import { routeFromNotificationData } from '../lib/notificationRouting';
import type { ActivityStackScreenProps } from '../navigation/types';
import { useTheme } from '../theme';

export function InterventionsScreen({ navigation }: ActivityStackScreenProps<'Activity'>) {
  const { colors, spacing } = useTheme();
  const { data: interventions } = useInterventions('pending');
  const { data: notifications } = useNotifications(5);
  const { data: transparency } = useTransparency({ limit: 3 });
  const intervention = interventions?.interventions?.[0];
  const resolve = useResolveIntervention(intervention?.id);

  return (
    <FixedScreen
      header={<AppHeader title="Activity" />}
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button title="History" variant="ghost" onPress={() => navigation.push('InterventionsHistory')} style={{ flex: 1 }} />
          <Button title="Transparency" onPress={() => navigation.push('TransparencyLog')} style={{ flex: 1 }} />
        </View>
      }
    >
      <Card style={{ backgroundColor: intervention ? colors.warningLight : colors.indigoLight }}>
        <Text style={{ color: intervention ? colors.warning : colors.indigoDark, fontWeight: '700' }}>
          {intervention ? 'Intervention needed' : 'No serious intervention'}
        </Text>
        <Text numberOfLines={3} style={{ color: colors.text, marginTop: 6 }}>
          {intervention?.summary ?? 'Sarthi will surface serious prompts here when a goal or task needs attention.'}
        </Text>
        {intervention ? (
          <Button title="Resolve" onPress={() => resolve.mutate()} loading={resolve.isPending} style={{ marginTop: spacing.md }} />
        ) : null}
      </Card>

      <View style={{ marginTop: spacing.md }}>
        <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12 }}>RECENT NOTIFICATIONS</Text>
        {(notifications?.notifications ?? []).slice(0, 3).map((item) => (
          <Pressable
            key={item.id}
            onPress={() => routeFromNotificationData(companionNotificationToRouteData(item))}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
          >
            <Card padding="sm" style={{ marginTop: spacing.sm }}>
              <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700' }}>
                {item.title}
              </Text>
              <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12 }}>
                {item.kind}
              </Text>
            </Card>
          </Pressable>
        ))}
      </View>

      <View style={{ flex: 1, marginTop: spacing.md }}>
        <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12 }}>TRANSPARENCY</Text>
        {(transparency?.items ?? []).slice(0, 2).map((item) => (
          <Card key={item.id} padding="sm" style={{ marginTop: spacing.sm }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700' }}>
              {item.headline}
            </Text>
            <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12 }}>
              {item.action_type}
            </Text>
          </Card>
        ))}
      </View>
    </FixedScreen>
  );
}
