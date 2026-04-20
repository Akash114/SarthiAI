import appJson from './app.json';

type AppJsonExpo = typeof appJson.expo & {
  extra?: Record<string, string | undefined>;
};

/**
 * Dynamic Expo config: merge EAS / CI env into `extra` for runtime (see `src/config.ts`).
 * Set secrets via EAS: `eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value ...`
 */
export default ({ config }: { config: Record<string, unknown> }) => {
  const root = appJson.expo as AppJsonExpo;
  const base = root.extra ?? {};
  return {
    ...config,
    ...root,
    extra: {
      ...base,
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? base.apiUrl ?? '',
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? base.sentryDsn ?? '',
      posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? base.posthogKey ?? '',
      posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? base.posthogHost ?? 'https://eu.i.posthog.com',
      sentryEnvironment:
        process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? base.sentryEnvironment ?? 'development',
    },
  };
};
