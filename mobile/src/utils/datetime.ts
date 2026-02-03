const ISO_DATE_REGEX = /^(\d{4}-\d{2}-\d{2})/;
const TIME_REGEX = /^(\d{2}):(\d{2})/;

const pad = (value: number) => value.toString().padStart(2, "0");

export function normalizeDateInput(value?: string | null): string {
  if (!value) return "";
  const match = value.match(ISO_DATE_REGEX);
  if (match) return match[1];
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
  }
  return value;
}

export function normalizeTimeInput(value?: string | null): string {
  if (!value) return "";
  const match = value.match(TIME_REGEX);
  if (match) return `${match[1]}:${match[2]}`;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
  }
  return value;
}

export function formatDisplayDate(value?: string | null): string | null {
  const normalized = normalizeDateInput(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  if (!year || !month || !day) return normalized;
  const displayDate = new Date(Date.UTC(year, month - 1, day));
  return displayDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatDisplayTime(value?: string | null): string | null {
  const normalized = normalizeTimeInput(value);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(":").map(Number);
  if (hours == null || minutes == null || Number.isNaN(hours) || Number.isNaN(minutes)) {
    return normalized;
  }
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  const paddedMinutes = minutes.toString().padStart(2, "0");
  return `${displayHour}:${paddedMinutes} ${period}`;
}

export function getSortTimestamp(day?: string | null, time?: string | null): number {
  const normalizedDay = normalizeDateInput(day);
  if (!normalizedDay) return Number.POSITIVE_INFINITY;
  const normalizedTime = normalizeTimeInput(time) || "00:00";
  const isoCandidate = `${normalizedDay}T${normalizedTime}`;
  const ts = Date.parse(isoCandidate);
  return Number.isNaN(ts) ? Number.POSITIVE_INFINITY : ts;
}

export function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type Schedulable = {
  scheduled_day?: string | null;
  scheduled_time?: string | null;
};

export function sortTasksBySchedule<T extends Schedulable>(list: T[]): T[] {
  return list
    .map((task, index) => ({ task, index }))
    .sort((a, b) => {
      const aTs = getSortTimestamp(a.task.scheduled_day, a.task.scheduled_time);
      const bTs = getSortTimestamp(b.task.scheduled_day, b.task.scheduled_time);
      const aFinite = Number.isFinite(aTs);
      const bFinite = Number.isFinite(bTs);
      if (aFinite && bFinite) {
        if (aTs === bTs) return a.index - b.index;
        return aTs - bTs;
      }
      if (aFinite) return -1;
      if (bFinite) return 1;
      return a.index - b.index;
    })
    .map((entry) => entry.task);
}

export function formatScheduleLabel(day?: string | null, time?: string | null): string {
  const formattedDate = formatDisplayDate(day);
  const formattedTime = formatDisplayTime(time);
  if (formattedDate && formattedTime) {
    return `${formattedDate} · ${formattedTime}`;
  }
  return formattedDate ?? formattedTime ?? "Flexible";
}
