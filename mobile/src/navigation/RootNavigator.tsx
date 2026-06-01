import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import type { RootStackParamList } from './types';
import { AuthNavigator } from './stacks/AuthStack';
import { OnboardingNavigator } from './stacks/OnboardingStack';
import { MainTabs } from './MainTabs';
import { useSessionStore } from '../state/sessionStore';

const RootStack = createNativeStackNavigator<RootStackParamList>();

function AuthGate() {
  const { colors } = useTheme();
  const accessToken = useSessionStore((s) => s.accessToken);
  const onboardingComplete = useSessionStore((s) => s.onboardingComplete);
  const sessionReady = useSessionStore((s) => s.sessionReady);
  const bootstrapSession = useSessionStore((s) => s.bootstrapSession);

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  const bootstrapping = !sessionReady || (accessToken != null && onboardingComplete === null);

  if (bootstrapping) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.indigo} />
      </View>
    );
  }

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
