import { type BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { type CompositeScreenProps, type NavigatorScreenParams } from '@react-navigation/native';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';

// Auth stack
export type AuthStackParamList = { Auth: undefined };

// Onboarding stack
export type OnboardingStackParamList = {
  Welcome: undefined;
  Personalize: { isOnboarding?: boolean };
  OnboardingNotifications: undefined;
  FirstGoal: undefined;
};

// Home stack (within HomeTab)
export type HomeStackParamList = {
  Home: undefined;
  FocusMode: { taskId?: string; taskTitle?: string };
  BrainDumpModal: { focusSessionId?: string; taskId?: string; goalId?: string; teamId?: string };
  BrainDumpReview: { dumpId: string };
  TaskDetail: { taskId: string };
};

export type TeamStackParamList = {
  TeamList: undefined;
  TeamCreate: undefined;
  TeamJoin: undefined;
  TeamBoard: { teamId: string };
  TeamCreateTask: { teamId: string; goalId?: string };
  TeamSharedTaskDetail: { teamId: string; taskId: string };
};

// Goals stack (within GoalsTab)
export type GoalsStackParamList = {
  Goals: undefined;
  GoalsAll: undefined;
  GoalDetail: { goalId: string };
  TaskDetail: { taskId: string };
  EditTask: { taskId: string };
  CreateTask: { goalId?: string; teamId?: string };
};

// Activity stack
export type ActivityStackParamList = {
  Activity: undefined;
  InterventionsHistory: undefined;
  TransparencyLog: undefined;
};

// Settings stack
export type SettingsStackParamList = {
  Settings: undefined;
  PersonalizeSettings: undefined;
  FocusHistory: undefined;
  BrainDumpHistory: undefined;
  BrainDumpDetail: { dumpId: string };
  BrainDumpReview: { dumpId: string };
};

// Main tab stack
export type MainTabParamList = {
  HomeTab: undefined;
  GoalsTab: NavigatorScreenParams<GoalsStackParamList>;
  TeamTab: NavigatorScreenParams<TeamStackParamList>;
  ActivityTab: NavigatorScreenParams<ActivityStackParamList>;
  SettingsTab: NavigatorScreenParams<SettingsStackParamList>;
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
export type GoalsStackScreenProps<T extends keyof GoalsStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<GoalsStackParamList, T>,
  MainTabScreenProps<keyof MainTabParamList>
>;
export type TeamStackScreenProps<T extends keyof TeamStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<TeamStackParamList, T>,
  MainTabScreenProps<keyof MainTabParamList>
>;
export type ActivityStackScreenProps<T extends keyof ActivityStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<ActivityStackParamList, T>,
  MainTabScreenProps<keyof MainTabParamList>
>;
export type SettingsStackScreenProps<T extends keyof SettingsStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<SettingsStackParamList, T>,
  MainTabScreenProps<keyof MainTabParamList>
>;

declare global {
  namespace ReactNavigation {
    // React Navigation expects declaration merging here.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
