# Sarthi mobile UI rules

Keep the existing indigo and white theme tokens in `src/theme/tokens.ts`.

Primary app screens should fit a modern 5+ inch phone without page-level scrolling. Build screens with a fixed header, a flexible body, and an optional fixed footer. Use `FixedScreen` for new work. If content can overflow, move it into a modal, a drill-in screen, a compact paginated list, or an internally scrolling text input. Do not add unbounded `ScrollView` or infinite `FlatList` layouts to primary screens.

## Google Sign-In

Google uses Expo Auth Session (`expo-auth-session`). Configure OAuth client IDs in `.env` (see `.env.example`). The **Continue with Google** button appears on the auth screen only when at least one client ID is set.

Use a **development or preview build** for Google OAuth on a physical device; Expo Go is unreliable for this flow.

## Maestro smoke

`maestro/slice.yaml` covers register, verify, onboarding, and home. Requires a dev backend that returns `verification_code` on password register.
