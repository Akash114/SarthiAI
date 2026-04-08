export type NotificationTask = {
  title: string;
  scheduled_day?: string | null;
  scheduled_time?: string | null;
};

export function useNotifications() {
  const registerForPushNotificationsAsync = async (_userId?: string | null): Promise<boolean> => {
    return false;
  };

  const scheduleTaskReminder = async (_task: NotificationTask): Promise<null> => {
    return null;
  };

  const cancelReminder = async (_notificationId: string): Promise<void> => {};

  return {
    registerForPushNotificationsAsync,
    scheduleTaskReminder,
    cancelReminder,
  };
}
