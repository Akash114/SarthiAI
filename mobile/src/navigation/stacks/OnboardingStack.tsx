import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../types';
import { WelcomeScreen } from '../../screens/WelcomeScreen';
import { PersonalizeScreen } from '../../screens/PersonalizeScreen';
import { BrainDumpScreen } from '../../screens/BrainDumpScreen';
import { PlanReviewScreen } from '../../screens/PlanReviewScreen';
import { PlanActivatedScreen } from '../../screens/PlanActivatedScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Personalize" component={PersonalizeScreen} />
      <Stack.Screen name="BrainDump" component={BrainDumpScreen} />
      <Stack.Screen name="PlanReview" component={PlanReviewScreen} />
      <Stack.Screen name="PlanActivated" component={PlanActivatedScreen} />
    </Stack.Navigator>
  );
}
