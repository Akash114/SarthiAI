import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { InterventionsStackParamList } from '../types';
import { InterventionsScreen } from '../../screens/InterventionsScreen';
import { InterventionsHistoryScreen } from '../../screens/InterventionsHistoryScreen';
import { TransparencyLogScreen } from '../../screens/TransparencyLogScreen';
import { TransparencyEntryDetailScreen } from '../../screens/TransparencyEntryDetailScreen';

const Stack = createNativeStackNavigator<InterventionsStackParamList>();

export function InterventionsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Interventions" component={InterventionsScreen} />
      <Stack.Screen name="InterventionsHistory" component={InterventionsHistoryScreen} />
      <Stack.Screen name="TransparencyLog" component={TransparencyLogScreen} />
      <Stack.Screen name="TransparencyEntry" component={TransparencyEntryDetailScreen} />
    </Stack.Navigator>
  );
}
