import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { SettingsStackParamList } from '../types';
import { SettingsScreen } from '../../screens/SettingsScreen';
import { PersonalizeScreen } from '../../screens/PersonalizeScreen';
import { BrainDumpHistoryScreen } from '../../screens/BrainDumpHistoryScreen';
import { BrainDumpDetailScreen } from '../../screens/BrainDumpDetailScreen';
import { FocusHistoryScreen } from '../../screens/FocusHistoryScreen';
import type { SettingsStackScreenProps } from '../types';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="PersonalizeSettings">
        {({ navigation, route }) => (
          <PersonalizeScreen
            navigation={navigation as SettingsStackScreenProps<'PersonalizeSettings'>['navigation']}
            route={route as SettingsStackScreenProps<'PersonalizeSettings'>['route']}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="BrainDumpHistory" component={BrainDumpHistoryScreen} />
      <Stack.Screen name="BrainDumpDetail" component={BrainDumpDetailScreen} />
      <Stack.Screen name="FocusHistory" component={FocusHistoryScreen} />
    </Stack.Navigator>
  );
}
