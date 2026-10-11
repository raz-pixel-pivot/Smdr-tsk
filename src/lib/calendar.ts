/** Read and write events on the user's calendars. */
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

/** True for a valid IANA time zone name. */
export function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
