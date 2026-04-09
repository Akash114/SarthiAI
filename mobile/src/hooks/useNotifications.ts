import { useCallback } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import Constants from "expo-constants";
import { registerPushToken } from "../api/notifications";
import { LAST_EXPO_PUSH_TOKEN_KEY } from "../pushTokenStorage";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type NotificationTask = {
  title: string;
  scheduled_day?: string | null;
  scheduled_time?: string | null;
};

const parseTaskSchedule = (task: NotificationTask): Date | null => {
  if (!task.scheduled_day || !task.scheduled_time) {
    return null;
  }
  const [year, month, day] = task.scheduled_day.split("-").map(Number);
  const [hour, minute] = task.scheduled_time.split(":").map(Number);
  if ([year, month, day, hour, minute].some((value) => Number.isNaN(value))) {
    return null;
  }
  return new Date(year, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0, 0, 0);
};

function resolveProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    process.env.EXPO_PROJECT_ID
  );
}

export function useNotifications() {
  const registerForPushNotificationsAsync = useCallback(
    async (userId?: string | null): Promise<boolean> => {
      const existing = await Notifications.getPermissionsAsync();
      let granted = existing.status === "granted";
      if (!granted) {
        const requested = await Notifications.requestPermissionsAsync();
        granted = requested.status === "granted";
      }
      if (!granted) {
        return false;
      }
      try {
        const projectId = resolveProjectId();
        const options: Notifications.ExpoPushTokenOptions | undefined = projectId ? { projectId } : undefined;
        const expoPushToken = await Notifications.getExpoPushTokenAsync(options);
        if (userId && expoPushToken?.data) {
          const token = expoPushToken.data;
          const previous = await AsyncStorage.getItem(LAST_EXPO_PUSH_TOKEN_KEY);
          if (previous === token) {
            return true;
          }
          try {
            await registerPushToken(userId, token, Platform.OS);
            await AsyncStorage.setItem(LAST_EXPO_PUSH_TOKEN_KEY, token);
          } catch {
            // backend registration best-effort
          }
        }
      } catch (err) {
        console.warn("push token registration failed", err);
      }
      return true;
    },
    [],
  );

  // Local scheduling is a UX fallback. Server-side task reminders (scheduler + Expo) are canonical when enabled.
  const scheduleTaskReminder = useCallback(async (task: NotificationTask) => {
    const triggerDate = parseTaskSchedule(task);
    if (!triggerDate || triggerDate.getTime() <= Date.now()) {
      return null;
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Sarathi AI",
        body: `Time for: ${task.title}`,
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
    return id;
  }, []);

  const cancelReminder = useCallback(async (notificationId: string) => {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }, []);

  return {
    registerForPushNotificationsAsync,
    scheduleTaskReminder,
    cancelReminder,
  };
}
