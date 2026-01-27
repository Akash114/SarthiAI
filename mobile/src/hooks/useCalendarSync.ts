import * as Calendar from "expo-calendar";

export type CalendarTask = {
  title: string;
  scheduled_day: string | null;
  scheduled_time: string | null;
  duration_min: number | null;
};

export async function requestCalendarPermissions(): Promise<boolean> {
  const calendarStatus = await Calendar.requestCalendarPermissionsAsync();
  const remindersStatus = await Calendar.requestRemindersPermissionsAsync().catch(() => ({ status: "granted" }));
  return calendarStatus.status === "granted" && remindersStatus.status === "granted";
}

export async function hasCalendarPermissions(): Promise<boolean> {
  const calendarStatus = await Calendar.getCalendarPermissionsAsync();
  const remindersStatus = await Calendar.getRemindersPermissionsAsync().catch(() => ({ status: "granted" }));
  return calendarStatus.status === "granted" && remindersStatus.status === "granted";
}

async function findSarathiCalendar() {
  const allCalendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return allCalendars.find((cal) => cal.title === "Sarathi AI");
}

async function getExistingCalendarId(): Promise<string | null> {
  const existing = await findSarathiCalendar();
  return existing?.id ?? null;
}

async function getOrCreateCalendar(): Promise<string> {
  const existing = await findSarathiCalendar();
  if (existing) return existing.id;

  const allCalendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const primary = allCalendars.find((cal) => cal.source?.isLocalAccount);
  const source: Calendar.Source =
    primary?.source ||
    ({
      isLocalAccount: true,
      name: "Sarathi AI",
    } as Calendar.Source);
  const ownerAccount = primary?.ownerAccount ?? "personal";
  const sourceId = primary?.source?.id;

  const calendarConfig: Calendar.Calendar = {
    title: "Sarathi AI",
    color: "#2563EB",
    entityType: Calendar.EntityTypes.EVENT,
    source,
    name: "Sarathi AI",
    ownerAccount,
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  } as Calendar.Calendar;
  if (sourceId) {
    // @ts-ignore - sourceId missing from type defs
    calendarConfig.sourceId = sourceId;
  }

  const newCalendarId = await Calendar.createCalendarAsync(calendarConfig);

  return newCalendarId;
}

function combineDateTime(day: string | null, time: string | null): Date | null {
  if (!day) return null;
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return null;
  const [hour = 9, minute = 0] = time ? time.split(":").map(Number) : [9, 0];
  return new Date(year, month - 1, date, hour, minute);
}

async function hasConflict(calendarId: string, start: Date, end: Date): Promise<boolean> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const calendarIds = calendars
    .filter((cal) => cal.id !== calendarId)
    .map((cal) => cal.id);
  if (!calendarIds.length) {
    return false;
  }
  const windowStart = new Date(start.getTime() - 5 * 60 * 1000);
  const windowEnd = new Date(end.getTime() + 5 * 60 * 1000);
  const events = await Calendar.getEventsAsync(calendarIds, windowStart, windowEnd);
  return events
    .filter((event) => event.calendarId !== calendarId)
    .some((event) => {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      return Math.max(eventStart.getTime(), start.getTime()) < Math.min(eventEnd.getTime(), end.getTime());
    });
}

export async function syncTaskToCalendar(task: CalendarTask) {
  const calendarId = await getOrCreateCalendar();
  const startDate = combineDateTime(task.scheduled_day, task.scheduled_time);
  if (!startDate) {
    throw new Error("Task must have a scheduled day to sync with calendar.");
  }
  const duration = task.duration_min ?? 30;
  const endDate = new Date(startDate.getTime() + duration * 60000);

  if (await hasConflict(calendarId, startDate, endDate)) {
    throw new Error("This time slot already has a calendar event.");
  }

  const eventId = await Calendar.createEventAsync(calendarId, {
    title: task.title,
    startDate,
    endDate,
  });

  return eventId;
}

export async function isTaskSynced(task: CalendarTask): Promise<boolean> {
  if (!task.scheduled_day) {
    return false;
  }
  const calendarId = await getExistingCalendarId();
  if (!calendarId) {
    return false;
  }
  const startDate = combineDateTime(task.scheduled_day, task.scheduled_time);
  if (!startDate) {
    return false;
  }
  const duration = task.duration_min ?? 30;
  const endDate = new Date(startDate.getTime() + duration * 60000);
  const windowStart = new Date(startDate.getTime() - 2 * 60 * 1000);
  const windowEnd = new Date(endDate.getTime() + 2 * 60 * 1000);
  const events = await Calendar.getEventsAsync([calendarId], windowStart, windowEnd);
  return events.some((event) => {
    const eventStart = new Date(event.startDate);
    const diff = Math.abs(eventStart.getTime() - startDate.getTime());
    return diff <= 60 * 1000 && event.title === task.title;
  });
}
