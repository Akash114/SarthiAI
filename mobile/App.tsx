import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';

import { SENTRY_DSN } from './src/config';
import { initAnalytics } from './src/lib/analytics';
import { AuthScreen } from './src/screens/AuthScreen';
import { SliceScreen } from './src/screens/SliceScreen';
import { useSessionStore } from './src/state/sessionStore';

const Stack = createNativeStackNavigator();
const queryClient = new QueryClient();

function AuthScreenGate() {
  return <AuthScreen />;
}

export default function App() {
  const accessToken = useSessionStore((s) => s.accessToken);

  useEffect(() => {
    if (SENTRY_DSN) {
      Sentry.init({ dsn: SENTRY_DSN });
    }
    void initAnalytics();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {accessToken ? (
            <Stack.Screen name="Slice" component={SliceScreen} />
          ) : (
            <Stack.Screen name="Auth" component={AuthScreenGate} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </QueryClientProvider>
  );
}
