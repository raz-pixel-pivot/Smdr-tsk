import type { T } from "@/i18n";
import { addDays, diffDays, formatDate } from "./dates";
import type { Label, Lang, Task } from "./types";

export const byOrder = (a: Task, b: Task) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);

export function tasksOn(tasks: Record<string, Task>, date: string) {
  const all = Object.values(tasks).filter((t) => t.date === date);
  const open = all.filter((t) => !t.done).sort(byOrder);
  const done = all.filter((t) => t.done).sort((a, b) => (a.doneAt ?? "").localeCompare(b.doneAt ?? "") || byOrder(a, b));
  return { all, open, done };
}

/** date -> { total, open } */
export function dayStats(tasks: Record<string, Task>) {
  const m = new Map<string, { total: number; open: number }>();
  for (const t of Object.values(tasks)) {
    const s = m.get(t.date) ?? { total: 0, open: 0 };
    s.total++;
    if (!t.done) s.open++;
    m.set(t.date, s);
  }
  return m;
}

export function carryOver(tasks: Record<string, Task>, today: string) {
  return Object.values(tasks)
    .filter((t) => !t.done && t.date < today)
    .sort((a, b) => a.date.localeCompare(b.date) || byOrder(a, b));
}

/** "Today" / "Tomorrow" / "Yesterday" / weekday name */
export function relDay(iso: string, today: string, lang: Lang, t: T) {
  const d = diffDays(iso, today);
  if (d === 0) return t("day.today");
  if (d === 1) return t("day.tomorrow");
  if (d === -1) return t("day.yesterday");
  return formatDate.weekdayLong(iso, lang);
}

/** Short label for lists: Today / Tomorrow / Yesterday, otherwise "Oct 12". */
export function shortDay(iso: string, today: string, lang: Lang, t: T) {
  const d = diffDays(iso, today);
  if (d >= -1 && d <= 1) return relDay(iso, today, lang, t);
  return formatDate.short(iso, lang);
}

export function labelTasks(tasks: Record<string, Task>, labelId: string) {
  return Object.values(tasks)
    .filter((t) => t.labelIds.includes(labelId))
    .sort((a, b) => a.date.localeCompare(b.date) || byOrder(a, b));
}

/** A label's range: its own dates, or first..last task date ("from tasks"). */
export function labelRange(label: Label, its: Task[]) {
  let start = label.startDate;
  let end = label.endDate;
  const fromTasks = !start && !end;
  if (fromTasks && its.length) {
    start = its[0].date;
    end = its[its.length - 1].date;
  }
  if (!start && end) start = end;
  if (!end && start) end = start;
  if (start && end && end < start) end = start;
  return { start, end, fromTasks: fromTasks && its.length > 0, explicit: !fromTasks };
}

export function rangeText(label: Label, its: Task[], lang: Lang, t: T) {
  const r = labelRange(label, its);
  const f = (iso: string) => formatDate.short(iso, lang);
  if (r.explicit) {
    if (label.startDate && label.endDate)
      return label.startDate === label.endDate ? f(label.startDate) : t("projects.range", { start: f(label.startDate), end: f(label.endDate) });
    if (label.startDate) return t("projects.from", { date: f(label.startDate) });
    if (label.endDate) return t("projects.until", { date: f(label.endDate) });
  }
  if (r.start && r.end) {
    const core = r.start === r.end ? f(r.start) : t("projects.range", { start: f(r.start), end: f(r.end) });
    return `${core} ${t("projects.fromTasks")}`;
  }
  return t("projects.noDates");
}

/** Owners of a task = owners of its labels; none = "No owner" (null). */
export function taskOwners(task: Task, labels: Label[]): (string | null)[] {
  const owners = new Set<string | null>();
  for (const id of task.labelIds) {
    const l = labels.find((x) => x.id === id);
    if (l?.owner) owners.add(l.owner);
  }
  return owners.size ? [...owners] : [null];
}

export { addDays };
