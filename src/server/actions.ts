"use server";

import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { db } from "@/db";
import { attachments, calendarLinks, labels, settings, taskLabels, taskShares, tasks } from "@/db/schema";
import { LANG_COOKIE } from "@/i18n";
import { isTimeZone } from "@/lib/calendar";
import { addDays, isValidIso } from "@/lib/dates";
import { MAX_FILE_BYTES } from "@/lib/limits";
import type { Attachment, InitialData, Lang, Share, ShareRole } from "@/lib/types";
import { requireAccess } from "./access";
import { AuthError, requireUser, type Me } from "./auth";
import { loadAll, publicFileUrl, toAttachment } from "./data";
import { CalendarNotConnected, listEvents, upsertEvent } from "./google";
import { SAMPLE_LABELS, SAMPLE_TASKS, sampleBody } from "./sample";

export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

// Server action errors are masked in production, so every action returns a Result
// with a readable message instead of throwing.
async function run<T>(fn: (me: Me) => Promise<T>): Promise<Result<T>> {
  try {
    const me = await requireUser();
    return { ok: true, data: await fn(me) };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    if (e instanceof CalendarNotConnected) return { ok: false, error: "calendarNotConnected" };
    const code = (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
    if (code === "23505") return { ok: false, error: "nameTaken" };
    console.error(e);
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assertId(id: unknown): asserts id is string {
  if (typeof id !== "string" || !UUID.test(id)) throw new Error("Invalid id");
}
function assertDate(d: unknown): asserts d is string {
  if (!isValidIso(d)) throw new Error("Invalid date");
}
function cleanText(v: unknown, max = 500): string {
  if (typeof v !== "string") throw new Error("Invalid text");
  const s = v.trim();
  if (!s) throw new Error("Empty text");
  return s.slice(0, max);
}
function optDate(v: unknown): string | null {
  if (v === null || v === "" || v === undefined) return null;
  assertDate(v);
  return v;
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function cleanEmail(v: unknown): string {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!EMAIL.test(s) || s.length > 254) throw new Error("invalidEmail");
  return s;
}
const COLOR = /^#[0-9a-f]{6}$/i;

/** Only links labels that belong to this user. */
async function ownLabelIds(userId: string, ids: unknown): Promise<string[]> {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  ids.forEach(assertId);
  const rows = await db
    .select({ id: labels.id })
    .from(labels)
    .where(and(eq(labels.userId, userId), inArray(labels.id, ids as string[])));
  return rows.map((r) => r.id);
}

// ---------- Load ----------

export async function reloadAll(): Promise<Result<InitialData>> {
  return run((me) => loadAll(me, "en"));
}

// ---------- Tasks ----------

export async function createTask(input: { id: string; date: string; title: string; sortOrder: number; labelIds: string[] }) {
  return run(async (me) => {
    assertId(input.id);
    assertDate(input.date);
    const title = cleanText(input.title);
    const labelIds = await ownLabelIds(me.id, input.labelIds);
    await db.insert(tasks).values({ id: input.id, userId: me.id, date: input.date, title, sortOrder: Number(input.sortOrder) || 0 });
    if (labelIds.length) await db.insert(taskLabels).values(labelIds.map((labelId) => ({ taskId: input.id, labelId, userId: me.id })));
    return null;
  });
}

export async function updateTask(id: string, patch: { title?: string; date?: string; done?: boolean; sortOrder?: number }) {
  return run(async (me) => {
    assertId(id);
    await requireAccess(me, id, "edit");
    const set: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };
    if (patch.title !== undefined) set.title = cleanText(patch.title);
    if (patch.date !== undefined) {
      assertDate(patch.date);
      set.date = patch.date;
    }
    if (patch.done !== undefined) {
      set.done = !!patch.done;
      set.doneAt = patch.done ? new Date() : null;
    }
    if (patch.sortOrder !== undefined) set.sortOrder = Number(patch.sortOrder) || 0;
    await db.update(tasks).set(set).where(eq(tasks.id, id));
    return null;
  });
}

/** Labels are personal: each person files a shared task under their own labels. */
export async function setTaskLabels(id: string, labelIds: string[]) {
  return run(async (me) => {
    assertId(id);
    await requireAccess(me, id, "view");
    const ids = await ownLabelIds(me.id, labelIds);
    await db.batch([
      db.delete(taskLabels).where(and(eq(taskLabels.taskId, id), eq(taskLabels.userId, me.id))),
      ...(ids.length ? [db.insert(taskLabels).values(ids.map((labelId) => ({ taskId: id, labelId, userId: me.id })))] : []),
    ]);
    return null;
  });
}

export async function deleteTask(id: string) {
  return run(async (me) => {
    assertId(id);
    await db
      .update(tasks)
      .set({ deletedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.userId, me.id)));
    return null;
  });
}

export async function restoreTask(id: string) {
  return run(async (me) => {
    assertId(id);
    await db
      .update(tasks)
      .set({ deletedAt: null })
      .where(and(eq(tasks.id, id), eq(tasks.userId, me.id)));
    return null;
  });
}

export async function getTaskBody(id: string) {
  return run(async (me) => {
    assertId(id);
    await requireAccess(me, id, "view");
    const [rows, files] = await db.batch([
      db
        .select({ body: tasks.body })
        .from(tasks)
        .where(and(eq(tasks.id, id), isNull(tasks.deletedAt))),
      db.select().from(attachments).where(eq(attachments.taskId, id)).orderBy(attachments.createdAt),
    ]);
    if (!rows.length) throw new Error("Task not found");
    return { body: rows[0].body as object | null, attachments: files.map(toAttachment) };
  });
}

/** The body arrives as a JSON string: editor attrs are prototype-less objects that
 *  server action serialization would silently drop. */
export async function saveTaskBody(id: string, bodyJson: string | null) {
  return run(async (me) => {
    assertId(id);
    await requireAccess(me, id, "edit");
    if (bodyJson !== null && typeof bodyJson !== "string") throw new Error("Invalid body");
    if (bodyJson && bodyJson.length > 900_000) throw new Error("Notes are too long");
    const body = bodyJson ? (JSON.parse(bodyJson) as object) : null;
    if (body && (body as { type?: string }).type !== "doc") throw new Error("Invalid body");
    await db.update(tasks).set({ body, updatedAt: new Date() }).where(eq(tasks.id, id));
    return null;
  });
}

// ---------- Files ----------

export async function addAttachment(input: { taskId: string; fileName: string; contentType: string; size: number; url: string }): Promise<Result<Attachment>> {
  return run(async (me) => {
    assertId(input.taskId);
    await requireAccess(me, input.taskId, "edit");
    if (input.size > MAX_FILE_BYTES) throw new Error("File is larger than 10 MB");
    let url: URL;
    try {
      url = new URL(input.url);
    } catch {
      throw new Error("Invalid file URL");
    }
    // Must be a private blob uploaded under this task's folder.
    if (url.protocol !== "https:" || !/\.private\.blob\.vercel-storage\.com$/i.test(url.hostname) || !url.pathname.startsWith(`/tasks/${input.taskId}/`))
      throw new Error("Invalid file URL");
    const [row] = await db
      .insert(attachments)
      .values({
        userId: me.id,
        taskId: input.taskId,
        fileName: cleanText(input.fileName, 300),
        contentType: String(input.contentType || "application/octet-stream").slice(0, 200),
        size: Math.max(0, Math.floor(input.size)),
        url: url.toString(),
      })
      .returning();
    return toAttachment(row);
  });
}

/** Turns a file's public link on (new random address) or off. */
export async function setAttachmentPublic(id: string, makePublic: boolean) {
  return run(async (me) => {
    assertId(id);
    const [file] = await db.select({ taskId: attachments.taskId }).from(attachments).where(eq(attachments.id, id));
    if (!file) throw new Error("File not found");
    await requireAccess(me, file.taskId, "edit");
    const token = makePublic ? randomBytes(18).toString("base64url") : null;
    await db.update(attachments).set({ publicToken: token }).where(eq(attachments.id, id));
    return { publicUrl: publicFileUrl(token) };
  });
}

// ---------- Sharing ----------

async function sharesOf(taskId: string): Promise<Share[]> {
  const rows = await db.select({ email: taskShares.email, role: taskShares.role }).from(taskShares).where(eq(taskShares.taskId, taskId)).orderBy(taskShares.createdAt);
  return rows;
}

/** Shares a task (or changes the role). Only the owner can. Returns the new share list. */
export async function shareTask(taskId: string, emailIn: string, roleIn: ShareRole) {
  return run(async (me) => {
    assertId(taskId);
    await requireAccess(me, taskId, "owner");
    const email = cleanEmail(emailIn);
    if (me.emails.includes(email)) throw new Error("shareSelf");
    const role: ShareRole = roleIn === "view" ? "view" : "edit";
    const existing = await sharesOf(taskId);
    if (existing.length >= 30 && !existing.some((s) => s.email === email)) throw new Error("Too many people on this task");
    await db
      .insert(taskShares)
      .values({ taskId, email, role, ownerEmail: me.email })
      .onConflictDoUpdate({ target: [taskShares.taskId, taskShares.email], set: { role } });
    return sharesOf(taskId);
  });
}

export async function unshareTask(taskId: string, emailIn: string) {
  return run(async (me) => {
    assertId(taskId);
    await requireAccess(me, taskId, "owner");
    const email = typeof emailIn === "string" ? emailIn.trim().toLowerCase() : "";
    await db.delete(taskShares).where(and(eq(taskShares.taskId, taskId), eq(taskShares.email, email)));
    return sharesOf(taskId);
  });
}

/** Removes a task someone shared with me from my planner. */
export async function leaveTask(taskId: string) {
  return run(async (me) => {
    assertId(taskId);
    if (!me.emails.length) return null;
    await db.batch([
      db.delete(taskShares).where(and(eq(taskShares.taskId, taskId), inArray(taskShares.email, me.emails))),
      db.delete(taskLabels).where(and(eq(taskLabels.taskId, taskId), eq(taskLabels.userId, me.id))),
      db.delete(calendarLinks).where(and(eq(calendarLinks.taskId, taskId), eq(calendarLinks.userId, me.id))),
    ]);
    return null;
  });
}

// ---------- Google Calendar ----------

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

async function appOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

/** Creates (or updates) an event in my Google Calendar for this task. */
export async function addToCalendar(taskId: string, time: string | null, tz: string) {
  return run(async (me) => {
    assertId(taskId);
    await requireAccess(me, taskId, "view");
    if (time !== null && !TIME.test(time)) throw new Error("Invalid time");
    if (!isTimeZone(tz)) throw new Error("Invalid time zone");
    const [[task], [link]] = await db.batch([
      db.select({ title: tasks.title, date: tasks.date }).from(tasks).where(eq(tasks.id, taskId)),
      db
        .select({ eventId: calendarLinks.eventId })
        .from(calendarLinks)
        .where(and(eq(calendarLinks.userId, me.id), eq(calendarLinks.taskId, taskId))),
    ]);
    const origin = await appOrigin();
    const ev = await upsertEvent(me.id, link?.eventId ?? null, {
      summary: task.title,
      description: origin ? `${origin}/task/${taskId}` : "",
      date: task.date,
      time,
      tz,
    });
    await db
      .insert(calendarLinks)
      .values({ userId: me.id, taskId, eventId: ev.id, htmlLink: ev.htmlLink })
      .onConflictDoUpdate({ target: [calendarLinks.userId, calendarLinks.taskId], set: { eventId: ev.id, htmlLink: ev.htmlLink } });
    return { htmlLink: ev.htmlLink };
  });
}

function plainText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function eventDoc(e: { description?: string; location?: string; htmlLink: string }, lang: Lang) {
  const p = (text: string, href?: string) => ({
    type: "paragraph",
    content: [{ type: "text", text, ...(href ? { marks: [{ type: "link", attrs: { href } }] } : {}) }],
  });
  const content = [];
  if (e.location) content.push(p(`${lang === "he" ? "מיקום" : "Location"}: ${e.location.slice(0, 500)}`));
  if (e.description) for (const line of plainText(e.description).slice(0, 5000).split("\n")) if (line.trim()) content.push(p(line));
  content.push(p(lang === "he" ? "פתיחה ביומן Google" : "Open in Google Calendar", e.htmlLink));
  return { type: "doc", content };
}

/** Imports my Google Calendar events in [from, to] as tasks. Already-imported events are skipped. */
export async function importCalendar(from: string, to: string, tz: string, lang: Lang) {
  return run(async (me) => {
    assertDate(from);
    assertDate(to);
    if (to < from) throw new Error("The end date is before the start date");
    if (to > addDays(from, 366)) throw new Error("Choose up to a year at a time");
    if (!isTimeZone(tz)) throw new Error("Invalid time zone");

    const events = (await listEvents(me.id, from, to, tz)).filter((e) => e.status !== "cancelled" && e.eventType !== "workingLocation");
    const items = events
      .map((e) => {
        const date = e.start?.date ?? e.start?.dateTime?.slice(0, 10) ?? "";
        const time = e.start?.dateTime ? e.start.dateTime.slice(11, 16) : null;
        return { e, date, time };
      })
      .filter((x) => isValidIso(x.date) && x.date >= from && x.date <= to);

    const known = items.length
      ? await db
          .select({ eventId: calendarLinks.eventId })
          .from(calendarLinks)
          .where(and(eq(calendarLinks.userId, me.id), inArray(calendarLinks.eventId, items.map((x) => x.e.id))))
      : [];
    const skip = new Set(known.map((k) => k.eventId));
    const fresh = items.filter((x) => !skip.has(x.e.id));

    if (fresh.length) {
      // New tasks go after whatever is already on each day.
      const dates = [...new Set(fresh.map((x) => x.date))];
      const existing = await db
        .select({ date: tasks.date, sortOrder: tasks.sortOrder })
        .from(tasks)
        .where(and(eq(tasks.userId, me.id), inArray(tasks.date, dates)));
      const top = new Map<string, number>();
      for (const r of existing) top.set(r.date, Math.max(top.get(r.date) ?? 0, r.sortOrder));

      const rows = fresh.map((x) => {
        const n = (top.get(x.date) ?? 0) + 1;
        top.set(x.date, n);
        const name = (x.e.summary || (lang === "he" ? "(ללא כותרת)" : "(No title)")).trim();
        return {
          id: crypto.randomUUID(),
          userId: me.id,
          date: x.date,
          title: (x.time ? `${x.time} ${name}` : name).slice(0, 500),
          sortOrder: n,
          body: eventDoc(x.e, lang),
          eventId: x.e.id,
          htmlLink: x.e.htmlLink,
        };
      });
      // Insert in chunks to keep each statement small.
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        await db.batch([
          db.insert(tasks).values(chunk.map(({ eventId: _e, htmlLink: _h, ...t }) => (void _e, void _h, t))),
          db
            .insert(calendarLinks)
            .values(chunk.map((t) => ({ userId: me.id, taskId: t.id, eventId: t.eventId, htmlLink: t.htmlLink })))
            .onConflictDoNothing(),
        ]);
      }
    }
    return { imported: fresh.length, skipped: items.length - fresh.length, data: await loadAll(me, lang) };
  });
}

// ---------- Labels ----------

export async function createLabel(input: { id: string; name: string; color: string; attachToTask?: string }) {
  return run(async (me) => {
    assertId(input.id);
    const name = cleanText(input.name, 80);
    const color = COLOR.test(input.color) ? input.color : "#475569";
    await db.insert(labels).values({ id: input.id, userId: me.id, name, color });
    if (input.attachToTask) {
      assertId(input.attachToTask);
      if (await requireAccess(me, input.attachToTask, "view").catch(() => null))
        await db.insert(taskLabels).values({ taskId: input.attachToTask, labelId: input.id, userId: me.id }).onConflictDoNothing();
    }
    return null;
  });
}

export async function updateLabel(
  id: string,
  patch: { name?: string; color?: string; owner?: string | null; ownerEmail?: string | null; startDate?: string | null; endDate?: string | null },
) {
  return run(async (me) => {
    assertId(id);
    const set: Partial<typeof labels.$inferInsert> = { updatedAt: new Date() };
    if (patch.name !== undefined) set.name = cleanText(patch.name, 80);
    if (patch.color !== undefined) {
      if (!COLOR.test(patch.color)) throw new Error("Invalid color");
      set.color = patch.color.toLowerCase();
    }
    if (patch.owner !== undefined) set.owner = patch.owner ? String(patch.owner).trim().slice(0, 80) || null : null;
    if (patch.ownerEmail !== undefined) set.ownerEmail = patch.ownerEmail ? cleanEmail(patch.ownerEmail) : null;
    if (patch.startDate !== undefined) set.startDate = optDate(patch.startDate);
    if (patch.endDate !== undefined) set.endDate = optDate(patch.endDate);
    await db
      .update(labels)
      .set(set)
      .where(and(eq(labels.id, id), eq(labels.userId, me.id)));
    return null;
  });
}

export async function deleteLabel(id: string) {
  return run(async (me) => {
    assertId(id);
    // Soft delete keeps the task links, so Undo brings everything back.
    await db
      .update(labels)
      .set({ deletedAt: new Date() })
      .where(and(eq(labels.id, id), eq(labels.userId, me.id)));
    return null;
  });
}

export async function restoreLabel(id: string) {
  return run(async (me) => {
    assertId(id);
    await db
      .update(labels)
      .set({ deletedAt: null })
      .where(and(eq(labels.id, id), eq(labels.userId, me.id)));
    return null;
  });
}

// ---------- Settings & sample data ----------

export async function updateSettings(patch: { language?: Lang; showCompleted?: boolean }) {
  return run(async (me) => {
    const set: Partial<typeof settings.$inferInsert> = { updatedAt: new Date() };
    if (patch.language !== undefined) {
      if (patch.language !== "en" && patch.language !== "he") throw new Error("Invalid language");
      set.language = patch.language;
      (await cookies()).set(LANG_COOKIE, patch.language, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
    if (patch.showCompleted !== undefined) set.showCompleted = !!patch.showCompleted;
    await db
      .insert(settings)
      .values({ userId: me.id, ...set })
      .onConflictDoUpdate({ target: settings.userId, set });
    return null;
  });
}

/** Creates settings plus sample data once, dated relative to the client's today. */
export async function seedIfNeeded(today: string, lang: Lang) {
  return run(async (me) => {
    const userId = me.id;
    assertDate(today);
    const language: Lang = lang === "he" ? "he" : "en";
    const claimed = await db
      .insert(settings)
      .values({ userId, language, seeded: true })
      .onConflictDoNothing()
      .returning({ userId: settings.userId });
    if (!claimed.length) return loadAll(me, language); // already seeded

    (await cookies()).set(LANG_COOKIE, language, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    const labelIds = new Map(SAMPLE_LABELS.map((l) => [l.key, crypto.randomUUID()]));
    const labelRows = SAMPLE_LABELS.map((l) => ({
      id: labelIds.get(l.key)!,
      userId,
      name: l.name[language],
      color: l.color,
      owner: l.owner?.[language] ?? null,
      startDate: l.start !== undefined ? addDays(today, l.start) : null,
      endDate: l.end !== undefined ? addDays(today, l.end) : null,
      isSample: true,
    }));
    const order = new Map<number, number>();
    const taskRows = SAMPLE_TASKS.map((t) => {
      const n = (order.get(t.o) ?? 0) + 1;
      order.set(t.o, n);
      return {
        id: crypto.randomUUID(),
        userId,
        date: addDays(today, t.o),
        title: t.title[language],
        done: !!t.done,
        doneAt: t.done ? new Date() : null,
        sortOrder: n,
        body: t.body ? sampleBody(language) : null,
        isSample: true,
        labels: t.labels ?? [],
      };
    });
    const links = taskRows.flatMap((t) => t.labels.map((k) => ({ taskId: t.id, labelId: labelIds.get(k)!, userId })));
    await db.batch([
      db.insert(labels).values(labelRows),
      db.insert(tasks).values(taskRows.map(({ labels: _unused, ...t }) => (void _unused, t))),
      db.insert(taskLabels).values(links),
    ]);
    return loadAll(me, language);
  });
}

export async function clearSampleData() {
  return run(async (me) => {
    const [t, l] = await db.batch([
      db
        .delete(tasks)
        .where(and(eq(tasks.userId, me.id), eq(tasks.isSample, true)))
        .returning({ id: tasks.id }),
      db
        .delete(labels)
        .where(and(eq(labels.userId, me.id), eq(labels.isSample, true)))
        .returning({ id: labels.id }),
    ]);
    return { tasks: t.length, labels: l.length };
  });
}
