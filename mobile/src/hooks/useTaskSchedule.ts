import { useCallback, useEffect, useState } from "react";
import * as Calendar from "expo-calendar";
import { listTasks } from "../api/tasks";
import { normalizeDateInput, normalizeTimeInput } from "../utils/datetime";

type OccupiedMap = Record<string, string[]>;

const DEFAULT_TIME_OPTIONS = [
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
];

type AvailabilityOptions = {
  blocked?: string[];
  currentTime?: string | null;
};

const formatDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const SLOT_DURATION_MINUTES = 60;

export function useTaskSchedule(userId: string | null) {
  const [occupied, setOccupied] = useState<OccupiedMap>({});

  const refresh = useCallback(async () => {
    if (!userId) {
      setOccupied({});
      return;
    }
    const today = new Date();
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 14);

    try {
      const rangeStart = new Date(today);
      rangeStart.setHours(0, 0, 0, 0);
      const rangeEnd = new Date(horizon);
      rangeEnd.setHours(23, 59, 59, 999);

      const { tasks } = await listTasks(userId, {
        status: "active",
        from: formatDate(today),
        to: formatDate(horizon),
      });
      const map: OccupiedMap = {};
      tasks.forEach((task) => {
        if (!task.scheduled_day || !task.scheduled_time) {
          return;
        }
        const dayKey = normalizeDateInput(task.scheduled_day);
        const timeKey = normalizeTimeInput(task.scheduled_time);
        if (!dayKey || !timeKey) {
          return;
        }
        const existing = map[dayKey] ? new Set(map[dayKey]) : new Set<string>();
        existing.add(timeKey);
        map[dayKey] = Array.from(existing);
      });
      const calendarBlocks = await loadCalendarConflicts(rangeStart, rangeEnd);
      Object.entries(calendarBlocks).forEach(([dayKey, slots]) => {
        const current = new Set(map[dayKey] ?? []);
        slots.forEach((slot) => current.add(slot));
        map[dayKey] = Array.from(current);
      });

      setOccupied(map);
    } catch {
      setOccupied({});
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getAvailableTimes = useCallback(
    (day: string, options: AvailabilityOptions = {}) => {
      if (!day) {
        return [];
      }
      const current = options.currentTime || undefined;
      const blocked = options.blocked?.filter(Boolean) ?? [];
      const taken = new Set(occupied[day] ?? []);
      blocked.forEach((time) => taken.add(time));
      if (current) {
        taken.delete(current);
      }
      const baseOptions = new Set(DEFAULT_TIME_OPTIONS);
      if (current) {
        baseOptions.add(current);
      }
      const sorted = Array.from(baseOptions).sort();
      return sorted.filter((slot) => !taken.has(slot) || slot === current);
    },
    [occupied],
  );

  return {
    getAvailableTimes,
    refresh,
    occupied,
  };
}

async function loadCalendarConflicts(rangeStart: Date, rangeEnd: Date): Promise<Record<string, string[]>> {
  try {
    let { status } = await Calendar.getCalendarPermissionsAsync();
    if (status !== "granted") {
      const requestResult = await Calendar.requestCalendarPermissionsAsync();
      status = requestResult.status;
    }
    if (status !== "granted") {
      return {};
    }

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (!calendars.length) {
      return {};
    }
    const calendarIds = calendars.map((cal) => cal.id);
    const events = await Calendar.getEventsAsync(calendarIds, rangeStart, rangeEnd);
    const conflicts: Record<string, Set<string>> = {};

    for (const event of events) {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      const dayCursor = new Date(eventStart);
      dayCursor.setHours(0, 0, 0, 0);
      const lastDay = new Date(eventEnd);
      lastDay.setHours(0, 0, 0, 0);

      while (dayCursor <= lastDay) {
        const dayKey = formatDate(dayCursor);
        DEFAULT_TIME_OPTIONS.forEach((slot) => {
          const [hours, minutes] = slot.split(":").map(Number);
          const slotStart = new Date(dayCursor);
          slotStart.setHours(hours, minutes, 0, 0);
          const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MINUTES * 60000);
          if (slotEnd > eventStart && slotStart < eventEnd) {
            const set = conflicts[dayKey] ?? new Set<string>();
            set.add(slot);
            conflicts[dayKey] = set;
          }
        });
        dayCursor.setDate(dayCursor.getDate() + 1);
      }
    }

    const normalized: Record<string, string[]> = {};
    Object.entries(conflicts).forEach(([day, slots]) => {
      normalized[day] = Array.from(slots);
    });
    return normalized;
  } catch {
    return {};
  }
}
