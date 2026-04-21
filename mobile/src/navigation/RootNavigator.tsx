import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import type { RootStackParamList } from './types';
import { AuthNavigator } from './stacks/AuthStack';
import { OnboardingNavigator } from './stacks/OnboardingStack';
import { MainTabs } from './MainTabs';
import { useSessionStore } from '../state/sessionStore';
import { useOnboarding } from '../hooks/queries';

const RootStack = createNativeStackNavigator<RootStackParamList>();

function AuthGate() {
  const accessToken = useSessionStore((s) => s.accessToken);
  const { data: onboarding } = useOnboarding();
  const onboardingComplete = onboarding?.status === 'completed';

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {!accessToken ? (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      ) : !onboardingComplete ? (
        <RootStack.Screen name="Onboarding" component={OnboardingNavigator} />
      ) : (
        <RootStack.Screen name="Main" component={MainTabs} />
      )}
    </RootStack.Navigator>
  );
}

export function RootNavigator() {
  useTheme();
  return <AuthGate />;
}
