import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ActivityStackParamList } from '../types';
import { InterventionsScreen } from '../../screens/InterventionsScreen';
import { InterventionsHistoryScreen } from '../../screens/InterventionsHistoryScreen';
import { TransparencyLogScreen } from '../../screens/TransparencyLogScreen';

const Stack = createNativeStackNavigator<ActivityStackParamList>();

export function ActivityStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Activity" component={InterventionsScreen} />
      <Stack.Screen name="InterventionsHistory" component={InterventionsHistoryScreen} />
      <Stack.Screen name="TransparencyLog" component={TransparencyLogScreen} />
    </Stack.Navigator>
  );
}
