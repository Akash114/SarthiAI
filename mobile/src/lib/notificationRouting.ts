import * as Notifications from 'expo-notifications';
import { supportsExpoNotifications } from './expoRuntime';
import { rootNavigationRef } from '../navigation/navigationRef';

export type NotificationData = {
  type?: string;
  task_id?: string;
  team_id?: string;
  goal_id?: string;
};

function isTaskReminderType(type: string | undefined): boolean {
  return type === 'task_due' || type === 'task_reminder';
}

/** Navigate from push notification payload (task due, intervention, team task). */
export function routeFromNotificationData(data: NotificationData): void {
  if (!rootNavigationRef.isReady()) return;

  if (isTaskReminderType(data.type) && typeof data.task_id === 'string' && data.task_id) {
    rootNavigationRef.navigate('Main', {
      screen: 'GoalsTab',
      params: {
        screen: 'TaskDetail',
        params: { taskId: data.task_id },
      },
    });
    return;
  }

  if (data.type === 'intervention_prompt') {
    rootNavigationRef.navigate('Main', {
      screen: 'ActivityTab',
      params: { screen: 'Activity' },
    });
    return;
  }

  if (data.type === 'goal_progress' && typeof data.goal_id === 'string' && data.goal_id) {
    rootNavigationRef.navigate('Main', {
      screen: 'GoalsTab',
      params: {
        screen: 'GoalDetail',
        params: { goalId: data.goal_id },
      },
    });
    return;
  }

  if (
    data.type === 'team_task_assigned' &&
    typeof data.team_id === 'string' &&
    typeof data.task_id === 'string' &&
    data.team_id &&
    data.task_id
  ) {
    rootNavigationRef.navigate('Main', {
      screen: 'TeamTab',
      params: {
        screen: 'TeamSharedTaskDetail',
        params: { teamId: data.team_id, taskId: data.task_id },
      },
    });
  }
}

/** Handle notification that opened the app from quit state (call from NavigationContainer onReady). */
export async function consumeInitialNotificationRoute(): Promise<void> {
  if (!supportsExpoNotifications()) return;
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return;
  const data = response.notification.request.content.data as NotificationData;
  routeFromNotificationData(data);
}

export function registerNotificationTapRouting(): () => void {
  if (!supportsExpoNotifications()) {
    return () => undefined;
  }

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as NotificationData;
    routeFromNotificationData(data);
  });
  return () => subscription.remove();
}
