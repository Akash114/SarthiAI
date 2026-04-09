import "react-native-get-random-values";
import "react-native-gesture-handler";
import * as React from "react";
import { useMemo } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createStackNavigator } from "@react-navigation/stack";
import { StatusBar } from "expo-status-bar";
import HomeScreen from "./src/screens/HomeScreen";
import BrainDumpScreen from "./src/screens/BrainDumpScreen";
import ResolutionCreateScreen from "./src/screens/ResolutionCreateScreen";
import PlanReviewScreen from "./src/screens/PlanReviewScreen";
import ResolutionsListScreen from "./src/screens/ResolutionsListScreen";
import MyWeekScreen from "./src/screens/MyWeekScreen";
import ResolutionDashboardScreen from "./src/screens/ResolutionDashboardScreen";
import ResolutionDashboardDetailScreen from "./src/screens/ResolutionDashboardDetailScreen";
import SettingsPermissionsScreen from "./src/screens/SettingsPermissionsScreen";
import PersonalizationScreen from "./src/screens/PersonalizationScreen";
import AgentLogScreen from "./src/screens/AgentLogScreen";
import AgentLogDetailScreen from "./src/screens/AgentLogDetailScreen";
import WeeklyPlanScreen from "./src/screens/WeeklyPlanScreen";
import InterventionsScreen from "./src/screens/InterventionsScreen";
import WeeklyPlanHistoryScreen from "./src/screens/WeeklyPlanHistoryScreen";
import WeeklyPlanHistoryDetailScreen from "./src/screens/WeeklyPlanHistoryDetailScreen";
import InterventionsHistoryScreen from "./src/screens/InterventionsHistoryScreen";
import InterventionsHistoryDetailScreen from "./src/screens/InterventionsHistoryDetailScreen";
import TaskEditScreen from "./src/screens/TaskEditScreen";
import TaskCreateScreen from "./src/screens/TaskCreateScreen";
import FocusModeScreen from "./src/screens/FocusModeScreen";
import SignInScreen from "./src/screens/SignInScreen";
import SignUpScreen from "./src/screens/SignUpScreen";
import AccountScreen from "./src/screens/AccountScreen";
import { SessionProvider, useSession } from "./src/session/SessionContext";
import { SessionBootstrapEffects } from "./src/session/SessionBootstrapEffects";
import { MutationQueueProvider } from "./src/offline/MutationQueueContext";
import { OfflineSyncBanner } from "./src/offline/OfflineSyncBanner";
import { ThemeProvider, useTheme } from "./src/theme";
import type { RootStackParamList } from "./types/navigation";

const NativeStack = createNativeStackNavigator<RootStackParamList>();
const WebStack = createStackNavigator<RootStackParamList>();

class RootErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      error: error instanceof Error ? error.message : "Unknown render error",
    };
  }

  componentDidCatch(error: unknown) {
    console.error("Root render error", error);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.errorRoot}>
          <Text style={styles.errorTitle}>App failed to render</Text>
          <Text style={styles.errorMessage}>{this.state.error}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function Navigator() {
  const { theme, isDark } = useTheme();
  const navigationTheme = useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
        background: theme.background,
        card: theme.surface,
        text: theme.textPrimary,
        border: theme.border,
        primary: theme.accent,
      },
    }),
    [isDark, theme],
  );

  const renderScreens = (Screen: any) => (
    <>
      <Screen name="Home" component={HomeScreen} options={{ title: "Sarthi AI" }} />
      <Screen name="BrainDump" component={BrainDumpScreen} options={{ title: "Brain Dump" }} />
      <Screen name="DraftPlans" component={ResolutionsListScreen} options={{ title: "Draft Plans" }} />
      <Screen name="MyWeek" component={MyWeekScreen} options={{ title: "My Week" }} />
      <Screen name="Dashboard" component={ResolutionDashboardScreen} options={{ title: "Dashboard" }} />
      <Screen name="WeeklyPlan" component={WeeklyPlanScreen} options={{ title: "Next Week Blueprint" }} />
      <Screen name="Interventions" component={InterventionsScreen} options={{ title: "Interventions" }} />
      <Screen name="WeeklyPlanHistory" component={WeeklyPlanHistoryScreen} options={{ title: "Blueprint History" }} />
      <Screen
        name="WeeklyPlanHistoryDetail"
        component={WeeklyPlanHistoryDetailScreen}
        options={{ title: "Blueprint Snapshot" }}
      />
      <Screen
        name="InterventionsHistory"
        component={InterventionsHistoryScreen}
        options={{ title: "Intervention History" }}
      />
      <Screen
        name="InterventionsHistoryDetail"
        component={InterventionsHistoryDetailScreen}
        options={{ title: "Intervention Snapshot" }}
      />
      <Screen
        name="SettingsPermissions"
        component={SettingsPermissionsScreen}
        options={{ title: "Settings & Permissions" }}
      />
      <Screen name="Personalization" component={PersonalizationScreen} options={{ title: "Personalize Flow" }} />
      <Screen name="AgentLog" component={AgentLogScreen} options={{ title: "Agent Log" }} />
      <Screen name="AgentLogDetail" component={AgentLogDetailScreen} options={{ title: "Log Detail" }} />
      <Screen
        name="ResolutionDashboardDetail"
        component={ResolutionDashboardDetailScreen}
        options={{ title: "Resolution Overview" }}
      />
      <Screen name="ResolutionCreate" component={ResolutionCreateScreen} options={{ title: "New Resolution" }} />
      <Screen name="PlanReview" component={PlanReviewScreen} options={{ title: "Plan Review" }} />
      <Screen name="TaskCreate" component={TaskCreateScreen} options={{ title: "New Task" }} />
      <Screen name="TaskEdit" component={TaskEditScreen} options={{ title: "Edit Task" }} />
      <Screen name="FocusMode" component={FocusModeScreen} options={{ headerShown: false, presentation: "modal" }} />
      <Screen name="SignIn" component={SignInScreen} options={{ title: "Sign in" }} />
      <Screen name="SignUp" component={SignUpScreen} options={{ title: "Create account" }} />
      <Screen name="Account" component={AccountScreen} options={{ title: "Account" }} />
    </>
  );

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style={isDark ? "light" : "dark"} />
      {Platform.OS === "web" ? (
        <WebStack.Navigator>{renderScreens(WebStack.Screen)}</WebStack.Navigator>
      ) : (
        <NativeStack.Navigator>{renderScreens(NativeStack.Screen)}</NativeStack.Navigator>
      )}
    </NavigationContainer>
  );
}

function SessionGate() {
  const { status } = useSession();
  const { theme } = useTheme();
  if (status === "bootstrapping") {
    return (
      <View style={[sessionGateStyles.splash, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }
  return (
    <SafeAreaProvider>
      <SessionBootstrapEffects />
      <MutationQueueProvider>
        <View style={{ flex: 1 }}>
          <OfflineSyncBanner />
          <View style={{ flex: 1 }}>
            <Navigator />
          </View>
        </View>
      </MutationQueueProvider>
    </SafeAreaProvider>
  );
}

function App() {
  return (
    <RootErrorBoundary>
      <ThemeProvider>
        <SessionProvider>
          <SessionGate />
        </SessionProvider>
      </ThemeProvider>
    </RootErrorBoundary>
  );
}

const sessionGateStyles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

const styles = StyleSheet.create({
  errorRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#fff",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    color: "#111827",
  },
  errorMessage: {
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
  },
});

export default App;
