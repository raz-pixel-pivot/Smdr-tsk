"use client";

import { create } from "zustand";
import * as api from "@/server/actions";
import type { Result } from "@/server/actions";
import { makeT, type T } from "@/i18n";
import { todayIso } from "@/lib/dates";
import { nextColor } from "@/lib/palette";
import type { InitialData, Label, Lang, Settings, Task } from "@/lib/types";

export type Toast = { id: number; text: string; kind: "info" | "error"; undo?: () => void };

type State = {
  tasks: Record<string, Task>;
  labels: Label[];
  settings: Settings;
  today: string;
  selected: string;
  toast: Toast | null;
  /** Bumped when the date strip should re-center on `selected`. */
  centerSeq: number;
};

type Actions = {
  init: (d: InitialData) => void;
  t: () => T;
  setToday: (iso: string) => void;
  select: (iso: string, recenter?: boolean) => void;
  showToast: (text: string, undo?: () => void, kind?: Toast["kind"]) => void;
  dismissToast: () => void;

  addTask: (title: string, date: string, labelIds: string[]) => void;
  setTitle: (id: string, title: string) => void;
  toggleDone: (id: string, toastText?: string) => void;
  moveTask: (id: string, date: string, toastText?: string) => void;
  reorder: (id: string, sortOrder: number) => void;
  setTaskLabels: (id: string, labelIds: string[]) => void;
  setHasBody: (id: string, hasBody: boolean) => void;
  deleteTask: (id: string) => void;

  addLabel: (name: string, attachToTask?: string) => Promise<string | null>;
  updateLabel: (id: string, patch: Partial<Omit<Label, "id" | "isSample">>) => void;
  deleteLabel: (id: string) => void;

  updateSettings: (patch: Partial<Pick<Settings, "language" | "showCompleted">>) => void;
};

export type Store = State & Actions;

let toastSeq = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<Store>()((set, get) => {
  /** Runs a server call; on failure restores the given snapshot and shows the error. */
  async function save<R>(call: () => Promise<Result<R>>, revert?: () => void): Promise<R | null> {
    let res: Result<R>;
    try {
      res = await call();
    } catch (e) {
      res = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    if (res.ok) return res.data;
    revert?.();
    const t = get().t();
    const msg = res.error === "nameTaken" ? t("projects.nameTaken") : t("toast.saveFailed", { error: res.error });
    get().showToast(msg, undefined, "error");
    return null;
  }

  const patchTask = (id: string, patch: Partial<Task>) =>
    set((s) => (s.tasks[id] ? { tasks: { ...s.tasks, [id]: { ...s.tasks[id], ...patch } } } : {}));
  const putTask = (task: Task) => set((s) => ({ tasks: { ...s.tasks, [task.id]: task } }));
  const dropTask = (id: string) =>
    set((s) => {
      const { [id]: _gone, ...rest } = s.tasks;
      return { tasks: rest };
    });

  return {
    tasks: {},
    labels: [],
    settings: { language: "en", showCompleted: true, seeded: true },
    today: todayIso(),
    selected: todayIso(),
    toast: null,
    centerSeq: 0,

    init: (d) =>
      set({
        tasks: Object.fromEntries(d.tasks.map((t) => [t.id, t])),
        labels: d.labels,
        settings: d.settings,
      }),

    t: () => makeT(get().settings.language),

    setToday: (iso) => {
      const s = get();
      if (iso === s.today) return;
      // Follow the date forward if the user was looking at "today" when it rolled over.
      set({ today: iso, ...(s.selected === s.today ? { selected: iso, centerSeq: s.centerSeq + 1 } : {}) });
    },

    select: (iso, recenter = false) => set((s) => ({ selected: iso, centerSeq: recenter ? s.centerSeq + 1 : s.centerSeq })),

    showToast: (text, undo, kind = "info") => {
      clearTimeout(toastTimer);
      const id = ++toastSeq;
      set({ toast: { id, text, undo, kind } });
      toastTimer = setTimeout(() => {
        if (get().toast?.id === id) set({ toast: null });
      }, 6000);
    },
    dismissToast: () => {
      clearTimeout(toastTimer);
      set({ toast: null });
    },

    addTask: (title, date, labelIds) => {
      const day = Object.values(get().tasks).filter((t) => t.date === date);
      const sortOrder = day.reduce((m, t) => Math.max(m, t.sortOrder), 0) + 1;
      const task: Task = {
        id: crypto.randomUUID(),
        date,
        title: title.trim(),
        done: false,
        doneAt: null,
        sortOrder,
        labelIds,
        hasBody: false,
        isSample: false,
      };
      putTask(task);
      save(() => api.createTask({ id: task.id, date, title: task.title, sortOrder, labelIds }), () => dropTask(task.id));
    },

    setTitle: (id, title) => {
      const prev = get().tasks[id];
      if (!prev || !title.trim() || title === prev.title) return;
      patchTask(id, { title });
      save(() => api.updateTask(id, { title }), () => patchTask(id, { title: prev.title }));
    },

    toggleDone: (id, toastText) => {
      const prev = get().tasks[id];
      if (!prev) return;
      const done = !prev.done;
      patchTask(id, { done, doneAt: done ? new Date().toISOString() : null });
      const revert = () => patchTask(id, { done: prev.done, doneAt: prev.doneAt });
      save(() => api.updateTask(id, { done }), revert);
      if (toastText)
        get().showToast(toastText, () => {
          revert();
          save(() => api.updateTask(id, { done: prev.done }));
        });
    },

    moveTask: (id, date, toastText) => {
      const prev = get().tasks[id];
      if (!prev || prev.date === date) return;
      // Lands at the end of the target day.
      const sortOrder = Object.values(get().tasks).reduce((m, t) => (t.date === date ? Math.max(m, t.sortOrder) : m), 0) + 1;
      patchTask(id, { date, sortOrder });
      const revert = () => patchTask(id, { date: prev.date, sortOrder: prev.sortOrder });
      save(() => api.updateTask(id, { date, sortOrder }), revert);
      if (toastText)
        get().showToast(toastText, () => {
          revert();
          save(() => api.updateTask(id, { date: prev.date, sortOrder: prev.sortOrder }));
        });
    },

    reorder: (id, sortOrder) => {
      const prev = get().tasks[id];
      if (!prev) return;
      patchTask(id, { sortOrder });
      save(() => api.updateTask(id, { sortOrder }), () => patchTask(id, { sortOrder: prev.sortOrder }));
    },

    setTaskLabels: (id, labelIds) => {
      const prev = get().tasks[id];
      if (!prev) return;
      patchTask(id, { labelIds });
      save(() => api.setTaskLabels(id, labelIds), () => patchTask(id, { labelIds: prev.labelIds }));
    },

    setHasBody: (id, hasBody) => patchTask(id, { hasBody }),

    deleteTask: (id) => {
      const prev = get().tasks[id];
      if (!prev) return;
      dropTask(id);
      save(() => api.deleteTask(id), () => putTask(prev));
      get().showToast(get().t()("toast.deleted"), () => {
        putTask(prev);
        save(() => api.restoreTask(id), () => dropTask(id));
      });
    },

    addLabel: async (name, attachToTask) => {
      const clean = name.trim();
      if (!clean) return null;
      const existing = get().labels.find((l) => l.name.toLowerCase() === clean.toLowerCase());
      if (existing) {
        if (attachToTask) {
          const task = get().tasks[attachToTask];
          if (task && !task.labelIds.includes(existing.id)) get().setTaskLabels(attachToTask, [...task.labelIds, existing.id]);
        }
        return existing.id;
      }
      const label: Label = {
        id: crypto.randomUUID(),
        name: clean,
        color: nextColor(get().labels.length),
        owner: null,
        startDate: null,
        endDate: null,
        isSample: false,
      };
      set((s) => ({ labels: [...s.labels, label] }));
      const prevTask = attachToTask ? get().tasks[attachToTask] : undefined;
      if (prevTask) patchTask(prevTask.id, { labelIds: [...prevTask.labelIds, label.id] });
      const ok = await save(
        () => api.createLabel({ id: label.id, name: clean, color: label.color, attachToTask }),
        () => {
          set((s) => ({ labels: s.labels.filter((l) => l.id !== label.id) }));
          if (prevTask) patchTask(prevTask.id, { labelIds: prevTask.labelIds });
        },
      );
      return ok === null ? null : label.id;
    },

    updateLabel: (id, patch) => {
      const prev = get().labels.find((l) => l.id === id);
      if (!prev) return;
      if (patch.name !== undefined && !patch.name.trim()) return;
      set((s) => ({ labels: s.labels.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
      save(
        () => api.updateLabel(id, patch),
        () => set((s) => ({ labels: s.labels.map((l) => (l.id === id ? prev : l)) })),
      );
    },

    deleteLabel: (id) => {
      const s0 = get();
      const idx = s0.labels.findIndex((l) => l.id === id);
      if (idx < 0) return;
      const prev = s0.labels[idx];
      const linked = Object.values(s0.tasks).filter((t) => t.labelIds.includes(id));
      const remove = () =>
        set((s) => ({
          labels: s.labels.filter((l) => l.id !== id),
          tasks: Object.fromEntries(
            Object.entries(s.tasks).map(([k, t]) => [k, t.labelIds.includes(id) ? { ...t, labelIds: t.labelIds.filter((x) => x !== id) } : t]),
          ),
        }));
      const restore = () =>
        set((s) => {
          const labels = [...s.labels];
          labels.splice(Math.min(idx, labels.length), 0, prev);
          const tasks = { ...s.tasks };
          for (const t of linked) if (tasks[t.id] && !tasks[t.id].labelIds.includes(id)) tasks[t.id] = { ...tasks[t.id], labelIds: [...tasks[t.id].labelIds, id] };
          return { labels, tasks };
        });
      remove();
      save(() => api.deleteLabel(id), restore);
      get().showToast(get().t()("toast.labelDeleted"), () => {
        restore();
        save(() => api.restoreLabel(id), remove);
      });
    },

    updateSettings: (patch) => {
      const prev = get().settings;
      set({ settings: { ...prev, ...patch } });
      if (patch.language) {
        document.documentElement.lang = patch.language;
        document.documentElement.dir = patch.language === "he" ? "rtl" : "ltr";
      }
      save(
        () => api.updateSettings(patch),
        () => {
          set({ settings: prev });
          document.documentElement.lang = prev.language;
          document.documentElement.dir = prev.language === "he" ? "rtl" : "ltr";
        },
      );
    },
  };
});

export const useT = () => {
  const lang = useStore((s) => s.settings.language);
  return makeT(lang);
};
export const useLang = (): Lang => useStore((s) => s.settings.language);
