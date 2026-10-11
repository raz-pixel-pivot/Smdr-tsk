import "server-only";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { calendarLinks, labels, settings, taskLabels, taskShares, tasks } from "@/db/schema";
import type { Attachment, InitialData, Label, Lang, Settings, Share, Task } from "@/lib/types";
import type { Me } from "./auth";

const taskCols = {
  id: tasks.id,
  date: tasks.date,
  title: tasks.title,
  done: tasks.done,
  doneAt: tasks.doneAt,
  sortOrder: tasks.sortOrder,
  isSample: tasks.isSample,
  hasBody: sql<boolean>`(${tasks.body} is not null)`,
};

export const fileUrl = (id: string) => `/api/files/${id}`;
export const publicFileUrl = (token: string | null) => (token ? `/s/${token}` : null);

export function toAttachment(a: { id: string; taskId: string; fileName: string; contentType: string; size: number; publicToken: string | null }): Attachment {
  return { id: a.id, taskId: a.taskId, fileName: a.fileName, contentType: a.contentType, size: a.size, url: fileUrl(a.id), publicUrl: publicFileUrl(a.publicToken) };
}

/** My tasks plus tasks shared with me, my labels and settings. */
export async function loadAll(me: Me, fallbackLang: Lang): Promise<InitialData> {
  const emails = me.emails.length ? me.emails : [""];
  const [ownRows, sharedRows, outShares, labelRows, linkRows, settingRows, calRows] = await db.batch([
    db
      .select(taskCols)
      .from(tasks)
      .where(and(eq(tasks.userId, me.id), isNull(tasks.deletedAt))),
    db
      .select({ ...taskCols, role: taskShares.role, ownerEmail: taskShares.ownerEmail })
      .from(taskShares)
      .innerJoin(tasks, eq(tasks.id, taskShares.taskId))
      .where(and(inArray(taskShares.email, emails), ne(tasks.userId, me.id), isNull(tasks.deletedAt))),
    db
      .select({ taskId: taskShares.taskId, email: taskShares.email, role: taskShares.role })
      .from(taskShares)
      .innerJoin(tasks, eq(tasks.id, taskShares.taskId))
      .where(eq(tasks.userId, me.id))
      .orderBy(taskShares.createdAt),
    db
      .select({
        id: labels.id,
        name: labels.name,
        color: labels.color,
        owner: labels.owner,
        ownerEmail: labels.ownerEmail,
        startDate: labels.startDate,
        endDate: labels.endDate,
        isSample: labels.isSample,
      })
      .from(labels)
      .where(and(eq(labels.userId, me.id), isNull(labels.deletedAt)))
      .orderBy(labels.createdAt),
    db.select({ taskId: taskLabels.taskId, labelId: taskLabels.labelId }).from(taskLabels).where(eq(taskLabels.userId, me.id)),
    db.select().from(settings).where(eq(settings.userId, me.id)),
    db.select({ taskId: calendarLinks.taskId, htmlLink: calendarLinks.htmlLink }).from(calendarLinks).where(eq(calendarLinks.userId, me.id)),
  ]);

  const liveLabels = new Set(labelRows.map((l) => l.id));
  const byTask = new Map<string, string[]>();
  for (const l of linkRows) {
    if (!liveLabels.has(l.labelId)) continue;
    byTask.set(l.taskId, [...(byTask.get(l.taskId) ?? []), l.labelId]);
  }
  const sharesOf = new Map<string, Share[]>();
  for (const s of outShares) sharesOf.set(s.taskId, [...(sharesOf.get(s.taskId) ?? []), { email: s.email, role: s.role }]);
  const calOf = new Map(calRows.map((c) => [c.taskId, c.htmlLink]));

  const base = (t: (typeof ownRows)[number]) => ({
    ...t,
    doneAt: t.doneAt ? new Date(t.doneAt).toISOString() : null,
    hasBody: !!t.hasBody,
    labelIds: byTask.get(t.id) ?? [],
    calendarLink: calOf.get(t.id) ?? null,
  });

  const taskList: Task[] = ownRows.map((t) => ({ ...base(t), access: "owner", sharedBy: null, sharedWith: sharesOf.get(t.id) ?? [] }));
  // A task can be shared with more than one of my addresses; keep the strongest role.
  const shared = new Map<string, Task>();
  for (const r of sharedRows) {
    const { role, ownerEmail, ...t } = r;
    const prev = shared.get(t.id);
    if (prev && prev.access === "edit") continue;
    shared.set(t.id, { ...base(t), isSample: false, access: role, sharedBy: ownerEmail, sharedWith: [] });
  }
  taskList.push(...shared.values());

  const s = settingRows[0];
  const settingsOut: Settings = s
    ? { language: s.language, showCompleted: s.showCompleted, seeded: s.seeded }
    : { language: fallbackLang, showCompleted: true, seeded: false };

  return { tasks: taskList, labels: labelRows as Label[], settings: settingsOut };
}
