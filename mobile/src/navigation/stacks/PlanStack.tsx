import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { PlanStackParamList } from '../types';
import { DashboardScreen } from '../../screens/DashboardScreen';
import { WeeklyPlanScreen } from '../../screens/WeeklyPlanScreen';
import { PlanReviewScreen } from '../../screens/PlanReviewScreen';
import { PlanHistoryScreen } from '../../screens/PlanHistoryScreen';

const Stack = createNativeStackNavigator<PlanStackParamList>();

export function PlanStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="WeeklyPlan" component={WeeklyPlanScreen} />
      <Stack.Screen name="PlanReview" component={PlanReviewScreen} />
      <Stack.Screen name="PlanHistory" component={PlanHistoryScreen} />
    </Stack.Navigator>
  );
}
