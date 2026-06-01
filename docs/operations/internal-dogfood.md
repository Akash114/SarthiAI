# Internal Android dogfood checklist

Use this checklist before sharing a preview APK with the team.

## 1) Install APK

1. Build and upload from `mobile/`:
   - `eas build --profile preview --platform android`
2. Share the EAS install link in your team channel.
3. Each tester installs the APK on a physical Android device.

## 2) Register

1. Open the app.
2. Register with a work email and password.
3. Confirm login lands on onboarding.

## 3) Complete onboarding

1. Welcome screen -> Continue.
2. Personalize work hours/preferences -> Continue.
3. Notifications screen:
   - Tap **Enable notifications**.
   - Accept OS prompt.
4. Brain Dump:
   - Enter at least 1 sentence.
   - Tap **Analyze Signal**.

## 4) Create and activate a plan

1. In Plan Review, tap **Start Resolution**.
2. Wait for week-1 plan generation.
3. Confirm tasks appear in the plan list.

## 5) Complete one task

1. Open a task from weekly plan.
2. Mark it complete.
3. Verify dashboard progress updates.

## 6) Check notifications

1. Keep app in background.
2. Trigger reminders from backend ops route or wait for scheduler:
   - `POST /v1/ops/jobs/run` with `{"job":"reminders"}` and `X-Ops-Key`.
3. Confirm push arrives and tapping opens the right in-app destination.

## 7) Check observability

1. Trigger one test Sentry event (client and backend).
2. Verify issues appear in:
   - Mobile Sentry project
   - API/worker Sentry project

## 8) Report bugs

When reporting, include:

- Device model + Android version
- App build link/version
- Repro steps
- Screenshot/screen recording
- Sentry issue link (if available)

## 9) Delete test account

1. Open Settings.
2. In **Delete account**, enter password.
3. Confirm delete.
4. Verify user is logged out and cannot access previous session.
