"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { attachments, labels, settings, taskLabels, tasks } from "@/db/schema";
import { LANG_COOKIE } from "@/i18n";
import { addDays, isValidIso } from "@/lib/dates";
import { MAX_FILE_BYTES } from "@/lib/limits";
import type { Attachment, InitialData, Lang } from "@/lib/types";
import { AuthError, requireUser } from "./auth";
import { loadAll } from "./data";
import { SAMPLE_LABELS, SAMPLE_TASKS, sampleBody } from "./sample";

export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

// Server action errors are masked in production, so every action returns a Result
// with a readable message instead of throwing.
async function run<T>(fn: (userId: string) => Promise<T>): Promise<Result<T>> {
  try {
    const userId = await requireUser();
    return { ok: true, data: await fn(userId) };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
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
  return run((userId) => loadAll(userId, "en"));
}

// ---------- Tasks ----------

export async function createTask(input: { id: string; date: string; title: string; sortOrder: number; labelIds: string[] }) {
  return run(async (userId) => {
    assertId(input.id);
    assertDate(input.date);
    const title = cleanText(input.title);
    const labelIds = await ownLabelIds(userId, input.labelIds);
    await db.insert(tasks).values({ id: input.id, userId, date: input.date, title, sortOrder: Number(input.sortOrder) || 0 });
    if (labelIds.length) await db.insert(taskLabels).values(labelIds.map((labelId) => ({ taskId: input.id, labelId, userId })));
    return null;
  });
}

export async function updateTask(id: string, patch: { title?: string; date?: string; done?: boolean; sortOrder?: number }) {
  return run(async (userId) => {
    assertId(id);
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
    const res = await db
      .update(tasks)
      .set(set)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
      .returning({ id: tasks.id });
    if (!res.length) throw new Error("Task not found");
    return null;
  });
}

export async function setTaskLabels(id: string, labelIds: string[]) {
  return run(async (userId) => {
    assertId(id);
    const own = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    if (!own.length) throw new Error("Task not found");
    const ids = await ownLabelIds(userId, labelIds);
    await db.batch([
      db.delete(taskLabels).where(and(eq(taskLabels.taskId, id), eq(taskLabels.userId, userId))),
      ...(ids.length ? [db.insert(taskLabels).values(ids.map((labelId) => ({ taskId: id, labelId, userId })))] : []),
    ]);
    return null;
  });
}

export async function deleteTask(id: string) {
  return run(async (userId) => {
    assertId(id);
    await db
      .update(tasks)
      .set({ deletedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    return null;
  });
}

export async function restoreTask(id: string) {
  return run(async (userId) => {
    assertId(id);
    await db
      .update(tasks)
      .set({ deletedAt: null })
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    return null;
  });
}

export async function getTaskBody(id: string) {
  return run(async (userId) => {
    assertId(id);
    const [rows, files] = await db.batch([
      db
        .select({ body: tasks.body })
        .from(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.userId, userId), isNull(tasks.deletedAt))),
      db
        .select()
        .from(attachments)
        .where(and(eq(attachments.taskId, id), eq(attachments.userId, userId))),
    ]);
    if (!rows.length) throw new Error("Task not found");
    return {
      body: rows[0].body as object | null,
      attachments: files.map(({ id, taskId, fileName, contentType, size, url }) => ({ id, taskId, fileName, contentType, size, url })) as Attachment[],
    };
  });
}

/** The body arrives as a JSON string: editor attrs are prototype-less objects that
 *  server action serialization would silently drop. */
export async function saveTaskBody(id: string, bodyJson: string | null) {
  return run(async (userId) => {
    assertId(id);
    if (bodyJson !== null && typeof bodyJson !== "string") throw new Error("Invalid body");
    if (bodyJson && bodyJson.length > 900_000) throw new Error("Notes are too long");
    const body = bodyJson ? (JSON.parse(bodyJson) as object) : null;
    if (body && (body as { type?: string }).type !== "doc") throw new Error("Invalid body");
    await db
      .update(tasks)
      .set({ body, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    return null;
  });
}

export async function addAttachment(input: { taskId: string; fileName: string; contentType: string; size: number; url: string }) {
  return run(async (userId) => {
    assertId(input.taskId);
    if (input.size > MAX_FILE_BYTES) throw new Error("File is larger than 10 MB");
    if (!/^https:\/\/[a-z0-9.-]+\.blob\.vercel-storage\.com\//i.test(input.url)) throw new Error("Invalid file URL");
    const own = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, input.taskId), eq(tasks.userId, userId)));
    if (!own.length) throw new Error("Task not found");
    const [row] = await db
      .insert(attachments)
      .values({
        userId,
        taskId: input.taskId,
        fileName: cleanText(input.fileName, 300),
        contentType: String(input.contentType || "application/octet-stream").slice(0, 200),
        size: Math.max(0, Math.floor(input.size)),
        url: input.url,
      })
      .returning();
    return { id: row.id };
  });
}

// ---------- Labels ----------

export async function createLabel(input: { id: string; name: string; color: string; attachToTask?: string }) {
  return run(async (userId) => {
    assertId(input.id);
    const name = cleanText(input.name, 80);
    const color = /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : "#475569";
    await db.insert(labels).values({ id: input.id, userId, name, color });
    if (input.attachToTask) {
      assertId(input.attachToTask);
      const own = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, input.attachToTask), eq(tasks.userId, userId)));
      if (own.length) await db.insert(taskLabels).values({ taskId: input.attachToTask, labelId: input.id, userId }).onConflictDoNothing();
    }
    return null;
  });
}

export async function updateLabel(
  id: string,
  patch: { name?: string; color?: string; owner?: string | null; startDate?: string | null; endDate?: string | null },
) {
  return run(async (userId) => {
    assertId(id);
    const set: Partial<typeof labels.$inferInsert> = { updatedAt: new Date() };
    if (patch.name !== undefined) set.name = cleanText(patch.name, 80);
    if (patch.color !== undefined) {
      if (!/^#[0-9a-f]{6}$/i.test(patch.color)) throw new Error("Invalid color");
      set.color = patch.color;
    }
    if (patch.owner !== undefined) set.owner = patch.owner ? String(patch.owner).trim().slice(0, 80) || null : null;
    if (patch.startDate !== undefined) set.startDate = optDate(patch.startDate);
    if (patch.endDate !== undefined) set.endDate = optDate(patch.endDate);
    await db
      .update(labels)
      .set(set)
      .where(and(eq(labels.id, id), eq(labels.userId, userId)));
    return null;
  });
}

export async function deleteLabel(id: string) {
  return run(async (userId) => {
    assertId(id);
    // Soft delete keeps the task links, so Undo brings everything back.
    await db
      .update(labels)
      .set({ deletedAt: new Date() })
      .where(and(eq(labels.id, id), eq(labels.userId, userId)));
    return null;
  });
}

export async function restoreLabel(id: string) {
  return run(async (userId) => {
    assertId(id);
    await db
      .update(labels)
      .set({ deletedAt: null })
      .where(and(eq(labels.id, id), eq(labels.userId, userId)));
    return null;
  });
}

// ---------- Settings & sample data ----------

export async function updateSettings(patch: { language?: Lang; showCompleted?: boolean }) {
  return run(async (userId) => {
    const set: Partial<typeof settings.$inferInsert> = { updatedAt: new Date() };
    if (patch.language !== undefined) {
      if (patch.language !== "en" && patch.language !== "he") throw new Error("Invalid language");
      set.language = patch.language;
      (await cookies()).set(LANG_COOKIE, patch.language, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
    if (patch.showCompleted !== undefined) set.showCompleted = !!patch.showCompleted;
    await db
      .insert(settings)
      .values({ userId, ...set })
      .onConflictDoUpdate({ target: settings.userId, set });
    return null;
  });
}

/** Creates settings plus sample data once, dated relative to the client's today. */
export async function seedIfNeeded(today: string, lang: Lang) {
  return run(async (userId) => {
    assertDate(today);
    const language: Lang = lang === "he" ? "he" : "en";
    const claimed = await db
      .insert(settings)
      .values({ userId, language, seeded: true })
      .onConflictDoNothing()
      .returning({ userId: settings.userId });
    if (!claimed.length) return loadAll(userId, language); // already seeded

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
      db.insert(tasks).values(taskRows.map(({ labels: _l, ...t }) => t)),
      db.insert(taskLabels).values(links),
    ]);
    return loadAll(userId, language);
  });
}

export async function clearSampleData() {
  return run(async (userId) => {
    const [t, l] = await db.batch([
      db
        .delete(tasks)
        .where(and(eq(tasks.userId, userId), eq(tasks.isSample, true)))
        .returning({ id: tasks.id }),
      db
        .delete(labels)
        .where(and(eq(labels.userId, userId), eq(labels.isSample, true)))
        .returning({ id: labels.id }),
    ]);
    return { tasks: t.length, labels: l.length };
  });
}

