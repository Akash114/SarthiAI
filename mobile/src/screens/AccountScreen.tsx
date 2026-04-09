import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LogOut, User } from "lucide-react-native";
import { useSession } from "../session/SessionContext";
import { useTheme } from "../theme";
import type { RootStackParamList } from "../../types/navigation";

type Nav = NativeStackNavigationProp<RootStackParamList, "Account">;

export default function AccountScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const { isAuthenticated, email, sessionExpired, logout, clearSessionExpired } = useSession();
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.iconWrap, { backgroundColor: theme.surfaceMuted }]}>
          <User size={40} color={theme.accent} />
        </View>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Account</Text>

        {sessionExpired ? (
          <View style={[styles.banner, { backgroundColor: theme.surfaceMuted, borderColor: theme.warning }]}>
            <Text style={[styles.bannerText, { color: theme.textPrimary }]}>
              Your session expired. Please sign in again.
            </Text>
            <TouchableOpacity onPress={clearSessionExpired} accessibilityRole="button">
              <Text style={[styles.bannerDismiss, { color: theme.accent }]}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {isAuthenticated ? (
          <>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Signed in as</Text>
            <Text style={[styles.email, { color: theme.textPrimary }]}>{email ?? "—"}</Text>

            <TouchableOpacity
              style={[styles.dangerBtn, { borderColor: theme.danger, opacity: loggingOut ? 0.7 : 1 }]}
              onPress={onLogout}
              disabled={loggingOut}
              accessibilityRole="button"
            >
              {loggingOut ? (
                <ActivityIndicator color={theme.danger} />
              ) : (
                <View style={styles.dangerRow}>
                  <LogOut size={20} color={theme.danger} />
                  <Text style={[styles.dangerText, { color: theme.danger }]}>Sign out</Text>
                </View>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[styles.body, { color: theme.textSecondary }]}>
              Sign in to sync your data across devices and keep your brain dumps and plans tied to an account.
            </Text>
            <TouchableOpacity
              style={[styles.primary, { backgroundColor: theme.accent }]}
              onPress={() => navigation.navigate("SignIn")}
              accessibilityRole="button"
            >
              <Text style={[styles.primaryText, { color: theme.accentText }]}>Sign in</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondary}
              onPress={() => navigation.navigate("SignUp")}
              accessibilityRole="button"
            >
              <Text style={[styles.secondaryText, { color: theme.accent }]}>Create account</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 24 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: "700", textAlign: "center", marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  email: { fontSize: 17, marginBottom: 28 },
  body: { fontSize: 15, lineHeight: 22, marginBottom: 24, textAlign: "center" },
  primary: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryText: { fontSize: 16, fontWeight: "600" },
  secondary: { paddingVertical: 12, alignItems: "center" },
  secondaryText: { fontSize: 15, fontWeight: "600" },
  dangerBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dangerText: { fontSize: 16, fontWeight: "600" },
  banner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  bannerText: { fontSize: 14, marginBottom: 8 },
  bannerDismiss: { fontSize: 14, fontWeight: "600" },
});
