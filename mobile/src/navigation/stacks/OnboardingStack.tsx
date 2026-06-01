import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../types';
import { WelcomeScreen } from '../../screens/WelcomeScreen';
import { PersonalizeScreen } from '../../screens/PersonalizeScreen';
import { OnboardingNotificationsScreen } from '../../screens/OnboardingNotificationsScreen';
import { GoalListScreen } from '../../screens/GoalListScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Personalize" component={PersonalizeScreen} />
      <Stack.Screen name="OnboardingNotifications" component={OnboardingNotificationsScreen} />
      <Stack.Screen name="FirstGoal">{() => <GoalListScreen finishOnboarding />}</Stack.Screen>
    </Stack.Navigator>
  );
}
