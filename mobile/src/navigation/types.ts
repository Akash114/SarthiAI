import { type BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { type CompositeScreenProps, type NavigatorScreenParams } from '@react-navigation/native';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';

// Auth stack
export type AuthStackParamList = { Auth: undefined };

// Onboarding stack
export type OnboardingStackParamList = {
  Welcome: undefined;
  Personalize: { isOnboarding?: boolean };
  BrainDump: { isOnboarding?: boolean };
  PlanReview: { isOnboarding?: boolean };
  PlanActivated: { resolutionId: string };
};

// Main tab stack
export type MainTabParamList = {
  HomeTab: undefined;
  PlanTab: NavigatorScreenParams<PlanStackParamList>;
  InterventionsTab: NavigatorScreenParams<InterventionsStackParamList>;
  SettingsTab: undefined;
};

// Home stack (within HomeTab)
export type HomeStackParamList = {
  Home: undefined;
  FocusMode: { taskId: string; taskTitle: string; durationMinutes?: number };
  BrainDumpModal: { isOnboarding?: boolean };
};

// Plan stack (within PlanTab)
export type PlanStackParamList = {
  Dashboard: undefined;
  WeeklyPlan: { resolutionId: string };
  PlanReview: { resolutionId: string; isOnboarding?: boolean };
  PlanHistory: { resolutionId: string };
};

// Interventions stack
export type InterventionsStackParamList = {
  Interventions: undefined;
  InterventionsHistory: undefined;
  TransparencyLog: undefined;
};

// Settings stack
export type SettingsStackParamList = {
  Settings: undefined;
  PersonalizeSettings: undefined;
};

// Root
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

// Screen props helpers
export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
export type AuthScreenProps<T extends keyof AuthStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<AuthStackParamList, T>,
  RootScreenProps<keyof RootStackParamList>
>;
export type OnboardingScreenProps<T extends keyof OnboardingStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<OnboardingStackParamList, T>,
  RootScreenProps<keyof RootStackParamList>
>;
export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  RootScreenProps<keyof RootStackParamList>
>;
export type HomeStackScreenProps<T extends keyof HomeStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, T>,
  MainTabScreenProps<keyof MainTabParamList>
>;
export type PlanStackScreenProps<T extends keyof PlanStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<PlanStackParamList, T>,
  MainTabScreenProps<keyof MainTabParamList>
>;
export type InterventionsStackScreenProps<T extends keyof InterventionsStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<InterventionsStackParamList, T>,
  MainTabScreenProps<keyof MainTabParamList>
>;
export type SettingsStackScreenProps<T extends keyof SettingsStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<SettingsStackParamList, T>,
  MainTabScreenProps<keyof MainTabParamList>
>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
