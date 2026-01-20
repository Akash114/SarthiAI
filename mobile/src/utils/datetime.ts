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
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getSortTimestamp(day?: string | null, time?: string | null): number {
  const normalizedDay = normalizeDateInput(day);
  if (!normalizedDay) return Number.POSITIVE_INFINITY;
  const normalizedTime = normalizeTimeInput(time) || "00:00";
  const isoCandidate = `${normalizedDay}T${normalizedTime}`;
  const ts = Date.parse(isoCandidate);
  return Number.isNaN(ts) ? Number.POSITIVE_INFINITY : ts;
}
