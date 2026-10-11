import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { CALENDAR_SCOPE } from "@/lib/calendar";

const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/** Thrown when the user hasn't connected Google Calendar (or the grant was revoked). */
export class CalendarNotConnected extends Error {
  constructor() {
    super("calendarNotConnected");
  }
}

async function token(userId: string): Promise<string> {
  const res = await (await clerkClient()).users.getUserOauthAccessToken(userId, "google");
  const tok = res.data.find((t) => !t.scopes || t.scopes.includes(CALENDAR_SCOPE));
  if (!tok?.token || (tok.scopes && !tok.scopes.includes(CALENDAR_SCOPE))) throw new CalendarNotConnected();
  return tok.token;
}

async function call<T>(userId: string, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await token(userId)}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) throw new CalendarNotConnected();
  if (!res.ok) throw new Error(`Google Calendar: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

export type GEvent = {
  id: string;
  status?: string;
  eventType?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink: string;
  start?: { date?: string; dateTime?: string };
};

/** Events between two local dates (inclusive), with times in `tz`. */
export async function listEvents(userId: string, from: string, to: string, tz: string): Promise<GEvent[]> {
  // Pad by a day on each side; callers filter by local date.
  const timeMin = new Date(Date.parse(`${from}T00:00:00Z`) - 86_400_000).toISOString();
  const timeMax = new Date(Date.parse(`${to}T23:59:59Z`) + 86_400_000).toISOString();
  const out: GEvent[] = [];
  let pageToken: string | undefined;
  do {
    const q = new URLSearchParams({ timeMin, timeMax, timeZone: tz, singleEvents: "true", orderBy: "startTime", maxResults: "250" });
    if (pageToken) q.set("pageToken", pageToken);
    const page = await call<{ items?: GEvent[]; nextPageToken?: string }>(userId, `${API}?${q}`);
    out.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken && out.length < 1000);
  return out;
}

export type EventInput = {
  summary: string;
  description: string;
  date: string;
  /** "HH:MM" for a one-hour event, null for all day. */
  time: string | null;
  tz: string;
};

function eventBody(e: EventInput) {
  if (!e.time) {
    const next = new Date(Date.parse(`${e.date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    return { summary: e.summary, description: e.description, start: { date: e.date }, end: { date: next } };
  }
  // Wall-clock arithmetic in UTC, then labelled with the user's time zone.
  const end = new Date(Date.parse(`${e.date}T${e.time}:00Z`) + 3_600_000).toISOString().slice(0, 19);
  return {
    summary: e.summary,
    description: e.description,
    start: { dateTime: `${e.date}T${e.time}:00`, timeZone: e.tz },
    end: { dateTime: end, timeZone: e.tz },
  };
}

/** Updates the event if it still exists, otherwise creates a new one. */
export async function upsertEvent(userId: string, eventId: string | null, e: EventInput): Promise<{ id: string; htmlLink: string }> {
  if (eventId) {
    try {
      const ev = await call<GEvent>(userId, `${API}/${encodeURIComponent(eventId)}`, { method: "PATCH", body: JSON.stringify(eventBody(e)) });
      if (ev.status !== "cancelled") return { id: ev.id, htmlLink: ev.htmlLink };
    } catch (err) {
      if (err instanceof CalendarNotConnected) throw err;
      // Deleted in Google: fall through and create a fresh one.
    }
  }
  const ev = await call<GEvent>(userId, API, { method: "POST", body: JSON.stringify(eventBody(e)) });
  return { id: ev.id, htmlLink: ev.htmlLink };
}
