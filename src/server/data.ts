import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { labels, settings, taskLabels, tasks } from "@/db/schema";
import type { InitialData, Label, Lang, Settings, Task } from "@/lib/types";

export async function loadAll(userId: string, fallbackLang: Lang): Promise<InitialData> {
  const [taskRows, labelRows, linkRows, settingRows] = await db.batch([
    db
      .select({
        id: tasks.id,
        date: tasks.date,
        title: tasks.title,
        done: tasks.done,
        doneAt: tasks.doneAt,
        sortOrder: tasks.sortOrder,
        isSample: tasks.isSample,
        hasBody: sql<boolean>`(${tasks.body} is not null)`,
      })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt))),
    db
      .select({
        id: labels.id,
        name: labels.name,
        color: labels.color,
        owner: labels.owner,
        startDate: labels.startDate,
        endDate: labels.endDate,
        isSample: labels.isSample,
      })
      .from(labels)
      .where(and(eq(labels.userId, userId), isNull(labels.deletedAt)))
      .orderBy(labels.createdAt),
    db.select({ taskId: taskLabels.taskId, labelId: taskLabels.labelId }).from(taskLabels).where(eq(taskLabels.userId, userId)),
    db.select().from(settings).where(eq(settings.userId, userId)),
  ]);

  const liveLabels = new Set(labelRows.map((l) => l.id));
  const byTask = new Map<string, string[]>();
  for (const l of linkRows) {
    if (!liveLabels.has(l.labelId)) continue;
    const arr = byTask.get(l.taskId) ?? [];
    arr.push(l.labelId);
    byTask.set(l.taskId, arr);
  }

  const taskList: Task[] = taskRows.map((t) => ({
    ...t,
    doneAt: t.doneAt ? new Date(t.doneAt).toISOString() : null,
    hasBody: !!t.hasBody,
    labelIds: byTask.get(t.id) ?? [],
  }));

  const s = settingRows[0];
  const settingsOut: Settings = s
    ? { language: s.language, showCompleted: s.showCompleted, seeded: s.seeded }
    : { language: fallbackLang, showCompleted: true, seeded: false };

  return { tasks: taskList, labels: labelRows as Label[], settings: settingsOut };
}
