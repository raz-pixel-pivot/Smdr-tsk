"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getTaskBody } from "@/server/actions";
import { addDays, isValidIso } from "@/lib/dates";
import { useStore, useT } from "@/store/store";
import { Checkbox } from "./Checkbox";
import { Editor } from "./Editor";
import { IconBack, IconPlus } from "./icons";

export function TaskPage({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const from = useSearchParams().get("from") ?? "daily";
  const task = useStore((s) => s.tasks[id]);
  const labels = useStore((s) => s.labels);
  const today = useStore((s) => s.today);
  const { setTitle, toggleDone, moveTask, setTaskLabels, deleteTask, addLabel, select } = useStore.getState();

  const [title, setTitleDraft] = useState(task?.title ?? "");
  const [labelDraft, setLabelDraft] = useState("");
  const [body, setBody] = useState<{ loaded: boolean; doc: object | null }>({ loaded: false, doc: null });

  useEffect(() => {
    let alive = true;
    getTaskBody(id).then((res) => {
      if (alive) setBody({ loaded: true, doc: res.ok ? res.data.body : null });
    });
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (task) setTitleDraft(task.title);
    // Only resync when the stored title changes (e.g. after a revert).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.title]);

  const backHref = from === "projects" ? "/projects" : from === "timeline" ? "/timeline" : "/";
  const backLabel = from === "projects" ? t("task.backToProjects") : from === "timeline" ? t("task.backToTimeline") : t("task.backToDay");

  if (!task) {
    return (
      <div>
        <Link href={backHref} className="back">
          <IconBack size={14} />
          {backLabel}
        </Link>
        <p className="muted">{t("task.notFound")}</p>
      </div>
    );
  }

  const commitTitle = () => {
    if (title.trim()) setTitle(id, title.trim());
    else setTitleDraft(task.title);
  };
  const setDate = (date: string) => {
    if (!isValidIso(date)) return;
    moveTask(id, date);
    if (from === "daily") select(date, true);
  };
  const createLabel = async () => {
    const v = labelDraft.trim();
    if (!v) return;
    setLabelDraft("");
    await addLabel(v, id);
  };

  return (
    <div className="task-page">
      <Link href={backHref} className="back">
        <IconBack size={14} />
        {backLabel}
      </Link>

      <section className="card task-card">
        <div className="task-title-row">
          <Checkbox large checked={task.done} label={t("task.toggle")} onChange={() => toggleDone(id)} />
          <input
            className="task-title"
            value={title}
            aria-label={t("task.titleLabel")}
            dir="auto"
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </div>

        <div className="section-label">{t("task.date")}</div>
        <div className="wrap-row">
          <input type="date" className="field" value={task.date} aria-label={t("task.dateLabel")} onChange={(e) => setDate(e.target.value)} />
          <button className="btn" onClick={() => setDate(today)}>
            {t("task.today")}
          </button>
          <button className="btn" onClick={() => setDate(addDays(today, 1))}>
            {t("task.tomorrow")}
          </button>
          <button className="btn" onClick={() => setDate(addDays(task.date, 7))}>
            {t("task.inAWeek")}
          </button>
        </div>

        <div className="section-label">{t("task.labels")}</div>
        <div className="wrap-row">
          {labels.map((l) => {
            const on = task.labelIds.includes(l.id);
            return (
              <button
                key={l.id}
                className={`label-chip ${on ? "on" : ""}`}
                style={{ "--c": l.color } as React.CSSProperties}
                aria-pressed={on}
                onClick={() => setTaskLabels(id, on ? task.labelIds.filter((x) => x !== l.id) : [...task.labelIds, l.id])}
              >
                {l.name}
              </button>
            );
          })}
          <div className="new-label">
            <input
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) createLabel();
              }}
              aria-label={t("task.newLabel")}
              placeholder={t("task.newLabel")}
            />
            <button aria-label={t("task.addLabel")} onClick={createLabel}>
              <IconPlus size={16} />
            </button>
          </div>
        </div>
      </section>

      {body.loaded ? <Editor key={id} taskId={id} initial={body.doc} /> : <section className="card editor-card" style={{ minHeight: 400 }} aria-busy="true" />}

      <button
        className="btn-link delete-task"
        onClick={() => {
          deleteTask(id);
          router.push(backHref);
        }}
      >
        {t("task.delete")}
      </button>
    </div>
  );
}
