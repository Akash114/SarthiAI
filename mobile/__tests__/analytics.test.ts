import {
  captureInterventionApproved,
  captureOnboardingStarted,
  capturePushTokenRegistered,
} from '../src/lib/analytics';

describe('analytics', () => {
  it('allows capture calls when PostHog is not initialized (no-op)', () => {
    expect(() => captureOnboardingStarted('resume')).not.toThrow();
    expect(() => captureInterventionApproved('iv-1')).not.toThrow();
    expect(() => capturePushTokenRegistered('android')).not.toThrow();
  });
});
