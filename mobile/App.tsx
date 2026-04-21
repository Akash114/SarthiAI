import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';

import { SENTRY_DSN, SENTRY_ENVIRONMENT } from './src/config';
import { initAnalytics } from './src/lib/analytics';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider } from './src/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

export default function App() {
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
      <SafeAreaProvider>
        <ThemeProvider>
          <NavigationContainer>
            <StatusBar style="dark" />
            <RootNavigator />
          </NavigationContainer>
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
