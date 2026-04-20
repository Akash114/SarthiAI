import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';

import { SENTRY_DSN, SENTRY_ENVIRONMENT } from './src/config';
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
      const version = Constants.expoConfig?.version ?? '0.0.0';
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: SENTRY_ENVIRONMENT,
        release: `sarthi-mobile@${version}`,
        dist:
          Constants.expoConfig?.android?.versionCode != null
            ? String(Constants.expoConfig.android.versionCode)
            : undefined,
        tracesSampleRate: 0.1,
        beforeSend(event) {
          if (event.request?.headers) {
            const h = { ...event.request.headers };
            for (const k of Object.keys(h)) {
              if (['authorization', 'cookie'].includes(k.toLowerCase())) {
                h[k] = '[redacted]';
              }
            }
            event.request.headers = h;
          }
          return event;
        },
      });
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
