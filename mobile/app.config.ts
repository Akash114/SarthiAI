import appJson from './app.json';

type AppJsonExpo = typeof appJson.expo & {
  extra?: Record<string, string | undefined> & {
    eas?: { projectId?: string };
  };
  android?: Record<string, unknown> & { package?: string };
  ios?: Record<string, unknown> & { bundleIdentifier?: string };
};

const ANDROID_PACKAGE = 'com.sarthiai.mobile';
const IOS_BUNDLE_ID = 'com.sarthiai.mobile';

/**
 * Dynamic Expo config: merge EAS / CI env into `extra` for runtime (see `src/config.ts`).
 * Set secrets via EAS: `eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value ...`
 *
 * Native builds (`expo run:android`) require android.package / ios.bundleIdentifier here
 * (Expo cannot auto-write them into this file).
 */
export default ({ config }: { config: Record<string, unknown> }) => {
  const root = appJson.expo as AppJsonExpo;
  const base = root.extra ?? {};

  const sentryOrg = process.env.SENTRY_ORG?.trim();
  const sentryProject = process.env.SENTRY_PROJECT?.trim();
  const sentryPlugin: [string, Record<string, string>] | null =
    sentryOrg && sentryProject
      ? ['@sentry/react-native/expo', { organization: sentryOrg, project: sentryProject }]
      : null;

  const plugins: (string | [string, Record<string, string>])[] = (root.plugins ?? []).filter(
    (entry) => {
      const name = Array.isArray(entry) ? entry[0] : entry;
      return name !== '@sentry/react-native/expo';
    },
  ) as (string | [string, Record<string, string>])[];
  if (sentryPlugin) {
    plugins.push([sentryPlugin[0], sentryPlugin[1]]);
  }

  const easProjectId = process.env.EAS_PROJECT_ID?.trim() || base.eas?.projectId;

  return {
    ...config,
    ...root,
    android: {
      ...root.android,
      package: (root.android?.package as string | undefined) ?? ANDROID_PACKAGE,
    },
    ios: {
      ...root.ios,
      bundleIdentifier: (root.ios?.bundleIdentifier as string | undefined) ?? IOS_BUNDLE_ID,
    },
    plugins,
    extra: {
      ...base,
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? base.apiUrl ?? '',
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? base.sentryDsn ?? '',
      posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? base.posthogKey ?? '',
      posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? base.posthogHost ?? 'https://eu.i.posthog.com',
      sentryEnvironment:
        process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? base.sentryEnvironment ?? 'development',
      googleWebClientId:
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? base.googleWebClientId ?? '',
      googleIosClientId:
        process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? base.googleIosClientId ?? '',
      googleAndroidClientId:
        process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? base.googleAndroidClientId ?? '',
      eas: easProjectId ? { projectId: easProjectId } : base.eas,
    },
  };
};
