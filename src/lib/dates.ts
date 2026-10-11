// Dates are plain "YYYY-MM-DD" strings in the user's local calendar.
// All arithmetic goes through UTC midnight so DST never shifts a day.

const DAY = 86_400_000;

function pad(n: number) {
  return n < 10 ? "0" + n : String(n);
}

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayIso(): string {
  return toIso(new Date());
}

function toUtc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(iso: string, n: number): string {
  return fromUtc(toUtc(iso) + n * DAY);
}

export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(a) - toUtc(b)) / DAY);
}

/** 0 = Sunday */
export function weekday(iso: string): number {
  return new Date(toUtc(iso)).getUTCDay();
}

export function dayOfMonth(iso: string): number {
  return Number(iso.slice(8, 10));
}

export function startOfWeek(iso: string): string {
  return addDays(iso, -weekday(iso));
}

export function isValidIso(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(toUtc(v)) && fromUtc(toUtc(v)) === v;
}

function locale(lang: string) {
  return lang === "he" ? "he-IL" : "en-US";
}

function fmt(iso: string, lang: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale(lang), { timeZone: "UTC", ...opts }).format(new Date(toUtc(iso)));
}

export const formatDate = {
  weekdayNarrow: (iso: string, lang: string) =>
    lang === "he" ? ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"][weekday(iso)] : fmt(iso, lang, { weekday: "narrow" }),
  weekdayLong: (iso: string, lang: string) => fmt(iso, lang, { weekday: "long" }),
  monthLong: (iso: string, lang: string) => fmt(iso, lang, { month: "long" }),
  /** "Sunday, October 11, 2026" */
  full: (iso: string, lang: string) => fmt(iso, lang, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  /** "Oct 11" / "11 באוק׳" */
  short: (iso: string, lang: string) => fmt(iso, lang, { day: "numeric", month: "short" }),
  /** "Mon, Oct 12" */
  weekdayShort: (iso: string, lang: string) => fmt(iso, lang, { weekday: "short", day: "numeric", month: "short" }),
};
