import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { HomeStackParamList, HomeStackScreenProps } from '../types';
import { HomeScreen } from '../../screens/HomeScreen';
import { FocusModeScreen } from '../../screens/FocusModeScreen';
import { BrainDumpScreen } from '../../screens/BrainDumpScreen';
import { BrainDumpReviewScreen } from '../../screens/BrainDumpReviewScreen';
import { TaskDetailScreen } from '../../screens/TaskDetailScreen';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="FocusMode" component={FocusModeScreen} />
      <Stack.Screen name="BrainDumpModal">
        {({ navigation, route }) => (
          <BrainDumpScreen
            navigation={navigation as HomeStackScreenProps<'BrainDumpModal'>['navigation']}
            route={route as HomeStackScreenProps<'BrainDumpModal'>['route']}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="BrainDumpReview" component={BrainDumpReviewScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
    </Stack.Navigator>
  );
}
