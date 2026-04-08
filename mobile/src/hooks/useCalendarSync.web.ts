export type CalendarTask = {
  title: string;
  scheduled_day: string | null;
  scheduled_time: string | null;
  duration_min: number | null;
};

export async function requestCalendarPermissions(): Promise<boolean> {
  return false;
}

export async function hasCalendarPermissions(): Promise<boolean> {
  return false;
}

export async function syncTaskToCalendar(_task: CalendarTask): Promise<null> {
  throw new Error("Calendar sync is not available on web. Use the mobile app for calendar integration.");
}

export async function isTaskSynced(_task: CalendarTask): Promise<boolean> {
  return false;
}
