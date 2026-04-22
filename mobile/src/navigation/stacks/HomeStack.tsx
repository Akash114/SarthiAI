import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../types';
import { HomeScreen } from '../../screens/HomeScreen';
import { FocusModeScreen } from '../../screens/FocusModeScreen';
import { FocusHistoryScreen } from '../../screens/FocusHistoryScreen';
import { BrainDumpScreen } from '../../screens/BrainDumpScreen';
import type { HomeStackScreenProps } from '../types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="FocusMode" component={FocusModeScreen} />
      <Stack.Screen name="FocusHistory" component={FocusHistoryScreen} />
      <Stack.Screen name="BrainDumpModal">
        {({ navigation, route }) => (
          <BrainDumpScreen
            navigation={navigation as HomeStackScreenProps<'BrainDumpModal'>['navigation']}
            route={route as HomeStackScreenProps<'BrainDumpModal'>['route']}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
