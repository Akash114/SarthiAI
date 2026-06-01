import type { CompanionNotification } from '../api/types';
import type { NotificationData } from './notificationRouting';

/** Map in-app notification row to push-style routing payload. */
export function companionNotificationToRouteData(notification: CompanionNotification): NotificationData {
  const payload = notification.payload_json;
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    return {
      type: typeof p.type === 'string' ? p.type : notification.kind,
      task_id: typeof p.task_id === 'string' ? p.task_id : notification.task_id ?? undefined,
      goal_id: typeof p.goal_id === 'string' ? p.goal_id : notification.goal_id ?? undefined,
      team_id: typeof p.team_id === 'string' ? p.team_id : notification.team_id ?? undefined,
    };
  }
  if (notification.kind === 'task_due' && notification.task_id) {
    return { type: 'task_due', task_id: notification.task_id };
  }
  if (notification.kind === 'goal_progress' && notification.goal_id) {
    return {
      type: 'goal_progress',
      goal_id: notification.goal_id,
      task_id: notification.task_id ?? undefined,
    };
  }
  return { type: notification.kind };
}
