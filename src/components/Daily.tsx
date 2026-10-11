"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { addDays, diffDays, formatDate } from "@/lib/dates";
import { carryOver, relDay, shortDay, tasksOn } from "@/lib/derive";
import type { Label, Task } from "@/lib/types";
import { useLang, useStore, useT } from "@/store/store";
import { DateStrip } from "./DateStrip";
import { Checkbox } from "./Checkbox";
import { IconGrip, IconNote, IconPlus } from "./icons";

export function Daily() {
  const t = useT();
  const lang = useLang();
  const tasks = useStore((s) => s.tasks);
  const labels = useStore((s) => s.labels);
  const today = useStore((s) => s.today);
  const selected = useStore((s) => s.selected);
  const showCompleted = useStore((s) => s.settings.showCompleted);

  const { all, open, done } = useMemo(() => tasksOn(tasks, selected), [tasks, selected]);
  const carry = useMemo(() => (selected === today ? carryOver(tasks, today) : []), [tasks, today, selected]);
  const pct = all.length ? Math.round((done.length / all.length) * 100) : 0;

  return (
    <div className="daily">
      <h1 className="page-title">{relDay(selected, today, lang, t)}</h1>
      <div className="subline">
        <span>{formatDate.full(selected, lang)}</span>
        <span className="progress">
          <span className="bar" aria-hidden>
            <span style={{ width: `${pct}%` }} />
          </span>
          {all.length ? (done.length === all.length ? t("daily.allDone") : t("daily.progress", { done: done.length, total: all.length })) : t("daily.noTasks")}
        </span>
      </div>

      <DateStrip />

      <div className="daily-cols">
        <div className="daily-main">
          {carry.length > 0 && <CarryOver tasks={carry} today={today} />}

          <section className="card list" aria-label={relDay(selected, today, lang, t)}>
            <OpenList tasks={open} labels={labels} selected={selected} today={today} />
            {done.length > 0 && <DoneList tasks={done} labels={labels} show={showCompleted} hasOpen={open.length > 0} />}
            {all.length === 0 && <div className="empty">{t("daily.empty")}</div>}
          </section>

          <CaptureBar date={selected} today={today} labels={labels} />
        </div>

        <ComingUp selected={selected} today={today} tasks={tasks} />
      </div>
    </div>
  );
}

function CarryOver({ tasks, today }: { tasks: Task[]; today: string }) {
  const t = useT();
  const lang = useLang();
  const toggleDone = useStore((s) => s.toggleDone);
  const moveTask = useStore((s) => s.moveTask);
  return (
    <section className="card carry">
      <h2 className="card-head">{t("daily.stillOpen")}</h2>
      {tasks.map((task) => (
        <div className="row carry-row" key={task.id}>
          <Checkbox checked={false} label={t("daily.markDone", { title: task.title })} onChange={() => toggleDone(task.id, t("toast.markedDone"))} />
          <Link href={`/task/${task.id}?from=daily`} className="row-main">
            <span className="row-title">{task.title}</span>
            <span className="row-sub danger">
              {diffDays(task.date, today) === -1 ? t("daily.fromYesterday") : t("daily.fromDate", { date: formatDate.short(task.date, lang) })}
            </span>
          </Link>
          <button className="chip-btn" onClick={() => moveTask(task.id, today, t("toast.movedToday"))}>
            {t("daily.toToday")}
          </button>
        </div>
      ))}
    </section>
  );
}

// A drag ends with a click on whatever row is under the pointer; swallow it.
let lastDragEnd = 0;

function OpenList({ tasks, labels, selected, today }: { tasks: Task[]; labels: Label[]; selected: string; today: string }) {
  const reorder = useStore((s) => s.reorder);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    lastDragEnd = Date.now();
    if (!over || active.id === over.id) return;
    const from = tasks.findIndex((x) => x.id === active.id);
    const to = tasks.findIndex((x) => x.id === over.id);
    const next = arrayMove(tasks, from, to);
    const before = next[to - 1]?.sortOrder;
    const after = next[to + 1]?.sortOrder;
    const order = before === undefined ? (after ?? 1) - 1 : after === undefined ? before + 1 : (before + after) / 2;
    reorder(String(active.id), order);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} onDragCancel={() => (lastDragEnd = Date.now())}>
      <SortableContext items={tasks.map((x) => x.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((task) => (
          <SortableRow key={task.id} task={task} labels={labels} selected={selected} today={today} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ task, labels, selected, today }: { task: Task; labels: Label[]; selected: string; today: string }) {
  const t = useT();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const { onKeyDown, ...pointerListeners } = listeners ?? {};
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`sortable ${isDragging ? "is-dragging" : ""}`}
      onClickCapture={(e) => {
        if (Date.now() - lastDragEnd < 300) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      {...pointerListeners}
    >
      <TaskRow
        task={task}
        labels={labels}
        selected={selected}
        today={today}
        handle={
          <button ref={setActivatorNodeRef} className="grip" {...attributes} onKeyDown={onKeyDown as React.KeyboardEventHandler<HTMLButtonElement> | undefined} aria-label={t("daily.dragHandle", { title: task.title })}>
            <IconGrip />
          </button>
        }
      />
    </div>
  );
}

function TaskRow({ task, labels, selected, today, handle }: { task: Task; labels: Label[]; selected: string; today: string; handle?: React.ReactNode }) {
  const t = useT();
  const lang = useLang();
  const toggleDone = useStore((s) => s.toggleDone);
  const moveTask = useStore((s) => s.moveTask);
  const chips = labels.filter((l) => task.labelIds.includes(l.id));
  const next = addDays(task.date, 1);
  const isToday = selected === today;
  return (
    <div className={`row task-row ${task.done ? "done" : ""}`}>
      <Checkbox
        checked={task.done}
        label={t(task.done ? "daily.markOpen" : "daily.markDone", { title: task.title })}
        onChange={() => toggleDone(task.id)}
      />
      <Link href={`/task/${task.id}?from=daily`} className="row-main" draggable={false}>
        <span className="row-title">{task.title}</span>
        {(chips.length > 0 || task.hasBody) && (
          <span className="row-sub">
            {chips.map((c) => (
              <span key={c.id} style={{ color: c.color }}>
                {c.name}
              </span>
            ))}
            {task.hasBody && (
              <span className="note-mark" title={t("daily.hasContent")}>
                <IconNote />
                <span className="sr-only">{t("daily.hasContent")}</span>
              </span>
            )}
          </span>
        )}
      </Link>
      {!task.done && (
        <button
          className="post-btn"
          aria-label={t("daily.postponeAria", { title: task.title })}
          onClick={() =>
            moveTask(
              task.id,
              next,
              next === addDays(today, 1) ? t("toast.postponedTomorrow") : t("toast.postponed", { date: shortDay(next, today, lang, t) }),
            )
          }
        >
          {isToday ? t("daily.toTomorrow") : t("daily.toNextDay")}
        </button>
      )}
      {handle}
    </div>
  );
}

function DoneList({ tasks, labels, show, hasOpen }: { tasks: Task[]; labels: Label[]; show: boolean; hasOpen: boolean }) {
  const t = useT();
  const today = useStore((s) => s.today);
  const selected = useStore((s) => s.selected);
  const updateSettings = useStore((s) => s.updateSettings);
  return (
    <>
      <button className={`done-head ${hasOpen ? "" : "first"}`} aria-expanded={show} onClick={() => updateSettings({ showCompleted: !show })}>
        <span>{t("daily.doneHeader", { n: tasks.length })}</span>
        <span>{show ? t("daily.hide") : t("daily.show")}</span>
      </button>
      {show && tasks.map((task) => <TaskRow key={task.id} task={task} labels={labels} selected={selected} today={today} />)}
    </>
  );
}

function CaptureBar({ date, today, labels }: { date: string; today: string; labels: Label[] }) {
  const t = useT();
  const lang = useLang();
  const addTask = useStore((s) => s.addTask);
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);

  const placeholder =
    date === today
      ? t("daily.newTaskToday")
      : date === addDays(today, 1)
        ? t("daily.newTaskTomorrow")
        : t("daily.newTaskFor", { date: formatDate.short(date, lang) });

  const submit = () => {
    const v = draft.trim();
    if (!v) return;
    addTask(v, date, picked);
    setDraft("");
    setPicked([]);
    input.current?.focus();
  };

  const showChips = labels.length > 0 && (draft.trim() !== "" || picked.length > 0);

  return (
    <div className="capture">
      <div className="capture-box">
        {showChips && (
          <div className="capture-chips">
            {labels.map((l) => {
              const on = picked.includes(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  className={`label-chip small ${on ? "on" : ""}`}
                  style={{ "--c": l.color } as React.CSSProperties}
                  aria-pressed={on}
                  // Keep focus in the input so typing can continue.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setPicked(on ? picked.filter((x) => x !== l.id) : [...picked, l.id])}
                >
                  {l.name}
                </button>
              );
            })}
          </div>
        )}
        <div className="capture-row">
          <input
            ref={input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            aria-label={t("daily.newTaskLabel")}
            placeholder={placeholder}
            enterKeyHint="enter"
            autoComplete="off"
          />
          <button className="round-btn" aria-label={t("daily.addTask")} onMouseDown={(e) => e.preventDefault()} onClick={submit}>
            <IconPlus />
          </button>
        </div>
      </div>
    </div>
  );
}

function ComingUp({ selected, today, tasks }: { selected: string; today: string; tasks: Record<string, Task> }) {
  const t = useT();
  const lang = useLang();
  const select = useStore((s) => s.select);
  const days = [1, 2, 3].map((i) => addDays(selected, i));
  return (
    <aside className="card coming">
      <h2 className="coming-title">{t("daily.comingUp")}</h2>
      {days.map((iso) => {
        const open = tasksOn(tasks, iso).open;
        return (
          <div className="coming-day" key={iso}>
            <button className="coming-head" onClick={() => select(iso, true)}>
              <span className="coming-label">
                {relDay(iso, today, lang, t)} · {formatDate.short(iso, lang)}
              </span>
              <span className="muted small">{open.length === 0 ? t("daily.free") : open.length === 1 ? t("daily.oneTask") : t("daily.tasksCount", { n: open.length })}</span>
            </button>
            {open.slice(0, 3).map((task) => (
              <Link key={task.id} href={`/task/${task.id}?from=daily`} className="coming-item">
                <span className="mini-box" aria-hidden />
                <span>{task.title}</span>
              </Link>
            ))}
            {open.length > 3 && <div className="muted small more">{t("daily.andMore", { n: open.length - 3 })}</div>}
          </div>
        );
      })}
    </aside>
  );
}
